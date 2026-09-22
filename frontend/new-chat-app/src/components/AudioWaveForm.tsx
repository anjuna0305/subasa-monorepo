import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

const SAMPLE_INTERVAL_MS = 40;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export interface AudioWaveformHandle {
  start: () => Promise<void>;
  stop: () => void;
}

interface AudioWaveformProps {
  width?: string | number;
  height?: number;
  barColor?: string;
  barCount?: number;
}

const AudioWaveform = forwardRef<AudioWaveformHandle, AudioWaveformProps>(
  (
    { width = "100%", height = 80, barColor = "#2563eb", barCount = 48 },
    ref,
  ) => {
    const [active, setActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const queueRef = useRef<Float32Array>(new Float32Array(barCount));
    const qHeadRef = useRef(0);
    const barsRef = useRef<(HTMLDivElement | null)[]>([]);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const rafRef = useRef<number | null>(null);
    const lastFrameRef = useRef<number>(0);

    const renderBars = useCallback(() => {
      const queue = queueRef.current;
      const qHead = qHeadRef.current;
      for (let i = 0; i < barCount; i++) {
        const idx = (qHead + i) % barCount;
        const amp = queue[idx];
        const fullH = Math.max(2, Math.round(amp * height));
        const bar = barsRef.current[i];
        if (!bar) continue;
        bar.style.height = `${fullH}px`;
        bar.style.marginTop = `${-fullH / 2}px`;
      }
    }, [height]);

    const startRafLoop = useCallback(() => {
      const loop = (timestamp: number) => {
        rafRef.current = requestAnimationFrame(loop);
        if (timestamp - lastFrameRef.current < FRAME_INTERVAL_MS) return;
        lastFrameRef.current = timestamp;
        renderBars();
      };
      rafRef.current = requestAnimationFrame(loop);
    }, [renderBars]);

    const stopRafLoop = useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }, []);

    const pushSample = useCallback(() => {
      const analyser = analyserRef.current;
      const dataArr = dataArrRef.current;
      if (!analyser || !dataArr) return;

      analyser.getByteTimeDomainData(dataArr);
      let sum = 0;
      for (let i = 0; i < dataArr.length; i++) {
        const v = (dataArr[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArr.length);
      queueRef.current[qHeadRef.current] = Math.min(1, rms * 4.5);
      qHeadRef.current = (qHeadRef.current + 1) % barCount;
    }, []);

    const start = useCallback(async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        dataArrRef.current = new Uint8Array(analyser.fftSize);

        audioCtx.createMediaStreamSource(stream).connect(analyser);
        intervalRef.current = setInterval(pushSample, SAMPLE_INTERVAL_MS);
        startRafLoop();
        setActive(true);
      } catch {
        setError("Microphone access denied");
      }
    }, [pushSample, startRafLoop]);

    const stop = useCallback(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRafLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      queueRef.current.fill(0);
      qHeadRef.current = 0;
      setActive(false);
      renderBars();
    }, [renderBars, stopRafLoop]);

    // expose start/stop to parent
    useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);

    useEffect(() => {
      renderBars();
      return () => stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div style={{ fontFamily: "inherit", width }}>
        <div
          style={{
            position: "relative",
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            padding: "0 4px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 1,
              background: "rgba(0,0,0,0.12)",
            }}
          />
          {Array.from({ length: barCount }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              style={{
                flex: 1,
                maxWidth: 14,
                minWidth: 4,
                height: 2,
                marginTop: "-1px",
                borderRadius: 2,
                background: barColor,
                transition: "height 0.07s ease-out, margin-top 0.07s ease-out",
              }}
            />
          ))}
        </div>

        {error && (
          <span style={{ fontSize: 13, color: "red", opacity: 0.7 }}>
            {error}
          </span>
        )}

        <style>{`@keyframes wv-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    );
  },
);

AudioWaveform.displayName = "AudioWaveform";

export default AudioWaveform;
