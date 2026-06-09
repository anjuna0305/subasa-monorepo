import { useEffect, useRef, useState, useCallback } from "react";

const BAR_COUNT = 48;
const SAMPLE_INTERVAL_MS = 40;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const CONTAINER_HEIGHT = 80; // total height of the visualizer area

export default function WaveForm2() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queueRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
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
    for (let i = 0; i < BAR_COUNT; i++) {
      const idx = (qHead + i) % BAR_COUNT;
      const amp = queue[idx];
      // full bar height spans both sides of the baseline
      const fullH = Math.max(2, Math.round(amp * CONTAINER_HEIGHT));
      const bar = barsRef.current[i];
      if (!bar) continue;
      bar.style.height = `${fullH}px`;
    }
  }, []);

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
    qHeadRef.current = (qHeadRef.current + 1) % BAR_COUNT;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
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

  useEffect(() => {
    renderBars();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        style={{
          position: "relative",
          height: CONTAINER_HEIGHT,
          display: "flex",
          alignItems: "center", // baseline is the vertical midpoint
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

        {Array.from({ length: BAR_COUNT }, (_, i) => (
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
              borderRadius: 2,
              background: "#2563eb",
              transition: "height 0.07s ease-out,  0.07s ease-out",
            }}
          />
        ))}
      </div>

      {/* controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
        }}
      >
        <button
          onClick={active ? stop : start}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 18px",
            borderRadius: 8,
            border: active
              ? "0.5px solid #1d4ed8"
              : "0.5px solid rgba(0,0,0,0.2)",
            background: active ? "#e0edff" : "transparent",
            color: active ? "#1d4ed8" : "inherit",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "currentColor",
              animation: active ? "wv-pulse 1s infinite" : "none",
            }}
          />
          {active ? "Stop mic" : "Enable mic"}
        </button>

        <span style={{ fontSize: 13, opacity: 0.6 }}>
          {error ?? (active ? "Listening…" : "Microphone off")}
        </span>
      </div>

      <style>{`@keyframes wv-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
