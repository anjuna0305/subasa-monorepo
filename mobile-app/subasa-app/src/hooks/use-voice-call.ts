import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { generateTts, sendMessage, transcribe } from '@/lib/api';
import { VoiceTuning } from '@/lib/config';
import {
  createSilenceDetector,
  meteringToLevel,
  recordingOptions,
  type TurnEndReason,
} from '@/lib/voice/recorder';
import { useConversation } from '@/state/conversation';

export type CallState =
  | 'connecting'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'error'
  | 'ended';

type TurnOutcome = { reason: TurnEndReason | 'aborted'; uri: string | null };

const NOTICE_CLEAR_MS = 2_500;

/**
 * Drives one voice call: listen → transcribe → reply → speak → listen, with no manual
 * playback controls. The whole turn is one linear async loop; the recorder's metering
 * poll and the player's finish event are bridged into promises so it reads top to bottom.
 */
export function useVoiceCall(urlPath: string) {
  const recorder = useAudioRecorder(recordingOptions);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const { append } = useConversation(urlPath);

  const [state, setState] = useState<CallState>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Refs, not state: the loop below runs outside React's render cycle and must see
  // current values without being torn down and restarted on every turn.
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const stateRef = useRef<CallState>('connecting');
  const appendRef = useRef(append);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortListenRef = useRef<(() => void) | null>(null);
  const finishPlaybackRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  appendRef.current = append;

  const applyState = useCallback((next: CallState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_CLEAR_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // Already stopped, or the session was torn down underneath us.
    }
  }, [recorder]);

  /** Records until the speaker stops, the cap is hit, or the call is muted/ended. */
  const listenForTurn = useCallback(async (): Promise<TurnOutcome> => {
    await recorder.prepareToRecordAsync(recordingOptions);
    if (!activeRef.current) return { reason: 'aborted', uri: null };

    recorder.record();
    applyState('listening');

    const detector = createSilenceDetector();
    const startTime = Date.now();

    const reason = await new Promise<TurnEndReason | 'aborted'>((resolve) => {
      abortListenRef.current = () => resolve('aborted');

      pollRef.current = setInterval(() => {
        if (!activeRef.current) {
          resolve('aborted');
          return;
        }

        const status = recorder.getStatus();
        setLevel(meteringToLevel(status.metering));

        const elapsed = status.durationMillis || Date.now() - startTime;
        const outcome = detector.push(status.metering, elapsed);
        if (outcome) resolve(outcome);
      }, VoiceTuning.meteringIntervalMs);
    });

    stopPolling();
    abortListenRef.current = null;
    setLevel(0);
    await stopRecorder();

    return { reason, uri: recorder.uri };
  }, [applyState, recorder, stopPolling, stopRecorder]);

  /** Resolves when the reply finishes playing, or when the listener interrupts it. */
  const speak = useCallback(
    async (audioUrl: string) => {
      player.replace({ uri: audioUrl });
      applyState('speaking');
      player.play();

      await new Promise<void>((resolve) => {
        finishPlaybackRef.current = resolve;
      });

      finishPlaybackRef.current = null;
    },
    [applyState, player]
  );

  const waitWhileMuted = useCallback(async () => {
    if (!mutedRef.current) return;
    applyState('muted');
    await new Promise<void>((resolve) => {
      unmuteRef.current = resolve;
    });
    unmuteRef.current = null;
  }, [applyState]);

  const runTurn = useCallback(async () => {
    const { reason, uri } = await listenForTurn();
    if (!activeRef.current || reason === 'aborted') return;

    if (reason === 'no-speech' || !uri) {
      if (reason === 'no-speech') flashNotice('Still there?');
      return;
    }

    applyState('transcribing');
    const spoken = await transcribe(uri);
    if (!activeRef.current) return;

    if (!spoken) {
      flashNotice("Didn't catch that");
      return;
    }

    appendRef.current({ role: 'user', text: spoken });

    applyState('thinking');
    const reply = await sendMessage(urlPath, spoken);
    if (!activeRef.current) return;

    if (!reply) {
      flashNotice('No reply came back');
      return;
    }

    appendRef.current({ role: 'bot', text: reply });

    let audioUrl: string | null = null;
    try {
      audioUrl = await generateTts(reply);
    } catch {
      // The reply is already in the transcript, so a synthesis failure costs the caller
      // the audio for this turn but should not drop the call.
      flashNotice('Could not play that reply');
    }
    if (!activeRef.current) return;

    if (audioUrl) await speak(audioUrl);
  }, [applyState, flashNotice, listenForTurn, speak, urlPath]);

  const runLoop = useCallback(async () => {
    while (activeRef.current) {
      try {
        await waitWhileMuted();
        if (!activeRef.current) return;
        await runTurn();
      } catch (caught) {
        if (!activeRef.current) return;
        stopPolling();
        await stopRecorder();
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
        applyState('error');
        return;
      }
    }
  }, [applyState, runTurn, stopPolling, stopRecorder, waitWhileMuted]);

  const start = useCallback(async () => {
    if (activeRef.current) return;

    setError(null);
    applyState('connecting');

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access is needed to make a call.');
      applyState('error');
      return;
    }

    // playsInSilentMode keeps the bot audible with the iOS ringer switch off, which is
    // what makes this feel like a call rather than a media player.
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    });

    activeRef.current = true;
    mutedRef.current = false;
    setIsMuted(false);
    setStartedAt(Date.now());
    void runLoop();
  }, [applyState, runLoop]);

  const end = useCallback(async () => {
    activeRef.current = false;
    stopPolling();
    abortListenRef.current?.();
    finishPlaybackRef.current?.();
    unmuteRef.current?.();
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);

    await stopRecorder();
    try {
      player.pause();
    } catch {
      // The player may already be released.
    }

    setLevel(0);
    setNotice(null);
    applyState('ended');
    await setAudioModeAsync({ allowsRecording: false });
  }, [applyState, player, stopPolling, stopRecorder]);

  /** Cuts the reply short and hands the turn straight back to the caller. */
  const interrupt = useCallback(() => {
    if (stateRef.current !== 'speaking') return;
    try {
      player.pause();
    } catch {
      // Nothing to stop.
    }
    finishPlaybackRef.current?.();
  }, [player]);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) {
      mutedRef.current = false;
      setIsMuted(false);
      unmuteRef.current?.();
      return;
    }

    mutedRef.current = true;
    setIsMuted(true);
    // Ends the in-flight listen; the loop then parks in waitWhileMuted. A turn that is
    // already transcribing or speaking runs to completion first.
    abortListenRef.current?.();
  }, []);

  useEffect(() => {
    if (stateRef.current !== 'speaking') return;
    if (playerStatus.didJustFinish) finishPlaybackRef.current?.();
  }, [playerStatus.didJustFinish]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopPolling();
      abortListenRef.current?.();
      finishPlaybackRef.current?.();
      unmuteRef.current?.();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, [stopPolling]);

  return {
    state,
    level,
    notice,
    error,
    startedAt,
    isMuted,
    start,
    end,
    interrupt,
    toggleMute,
  };
}
