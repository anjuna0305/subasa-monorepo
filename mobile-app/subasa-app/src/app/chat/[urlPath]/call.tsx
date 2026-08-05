import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVoiceCall, type CallState } from '@/hooks/use-voice-call';
import { getChatbotByUrlPath, heroImageUrl, type Chatbot } from '@/lib/api';

const EndCallRed = '#E5484D';

const CAPTIONS: Record<CallState, string> = {
  connecting: 'Connecting…',
  listening: 'Listening',
  transcribing: 'Got it…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  muted: 'Muted',
  error: 'Call failed',
  ended: 'Call ended',
};

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function useCallTimer(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return '0:00';
  return formatDuration(now - startedAt);
}

export default function CallScreen() {
  const { urlPath } = useLocalSearchParams<{ urlPath: string }>();
  const theme = useTheme();
  const call = useVoiceCall(urlPath);
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const elapsed = useCallTimer(call.startedAt);

  // The call must start once on mount and stop once on unmount, independent of the
  // identity of these callbacks across renders.
  const startRef = useRef(call.start);
  const endRef = useRef(call.end);
  startRef.current = call.start;
  endRef.current = call.end;

  useEffect(() => {
    void startRef.current();
    return () => {
      void endRef.current();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getChatbotByUrlPath(urlPath)
      .then((result) => {
        if (!cancelled) setChatbot(result);
      })
      .catch(() => {
        // The call itself does not depend on this; the header just stays generic.
      });
    return () => {
      cancelled = true;
    };
  }, [urlPath]);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // While the bot talks the orb breathes on its own, since input metering is idle then.
    const target = call.state === 'speaking' ? 0.6 : call.level;
    Animated.timing(pulse, {
      toValue: target,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [call.level, call.state, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  const hangUp = async () => {
    await call.end();
    router.back();
  };

  const heroUrl = chatbot ? heroImageUrl(chatbot) : null;
  const caption = call.notice ?? CAPTIONS[call.state];

  if (call.state === 'error') {
    return (
      <ThemedView style={[styles.container, styles.errorContainer]}>
        <SafeAreaView style={styles.errorContent}>
          <ThemedText type="subtitle">Call failed</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {call.error}
          </ThemedText>
          <View style={styles.errorActions}>
            <Pressable
              onPress={() => void call.start()}
              style={[styles.pillButton, { backgroundColor: theme.text }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Try again
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={hangUp}
              style={[styles.pillButton, styles.outlineButton, { borderColor: theme.text }]}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Tapping anywhere cuts the reply short and hands the turn back to the caller. */}
      <Pressable style={styles.pressArea} onPress={call.interrupt}>
        <SafeAreaView style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.centeredText}>
              {chatbot?.chatbot_name ?? 'Calling…'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {elapsed}
            </ThemedText>
          </View>

          <View style={styles.orbArea}>
            <Animated.View
              style={[
                styles.glow,
                { backgroundColor: theme.text, opacity: glowOpacity, transform: [{ scale }] },
              ]}
            />
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              {heroUrl ? (
                <Image source={{ uri: heroUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : null}
            </View>
          </View>

          <View style={styles.captionArea}>
            <ThemedText type="default" themeColor="textSecondary">
              {caption}
            </ThemedText>
            {call.state === 'speaking' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Tap anywhere to interrupt
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={call.toggleMute}
              style={[
                styles.controlButton,
                {
                  backgroundColor: call.isMuted ? theme.text : theme.backgroundElement,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: call.isMuted ? theme.background : theme.text }}>
                {call.isMuted ? 'Unmute' : 'Mute'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={hangUp}
              style={[styles.controlButton, { backgroundColor: EndCallRed }]}>
              <ThemedText type="smallBold" style={styles.endLabel}>
                End call
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pressArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  centeredText: {
    textAlign: 'center',
  },
  orbArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 240,
    height: 240,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  captionArea: {
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 48,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  controlButton: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minWidth: 120,
    alignItems: 'center',
  },
  endLabel: {
    color: '#ffffff',
  },
  errorContainer: {
    justifyContent: 'center',
  },
  errorContent: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pillButton: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  outlineButton: {
    borderWidth: 1,
  },
});
