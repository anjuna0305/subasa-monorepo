import { MicVAD } from "@ricky0123/vad-web";

export type ClientMessage = { type: "stop" } | { type: "cancel" };

export type ServerMessage =
  | { type: "result"; transcript: string; reply: string }
  | { type: "error"; message: string }
  | { type: "ack" };

// all weaks are here, adjust them according to the environment
const sampleRateHz = 16000;
const inputChannelCount = 1;
const audioBPS = 32000;
const mimeType = "audio/webm;codec=opus";
const timeSlice = 500; //in miliseconds

export class VoiceRecorder {
  private ws: WebSocket;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";
  }

  async init(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: sampleRateHz,
        channelCount: inputChannelCount,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.recorder = new MediaRecorder(this.stream, {
      mimeType: mimeType,
      audioBitsPerSecond: audioBPS,
    });

    this.recorder.onstop = () => {
      const tracks = this.stream?.getTracks();
      tracks?.forEach((track) => track.stop());
    };
  }

  start(): void {
    if (!this.recorder) throw new Error("call init() first");

    this.recorder.ondataavailable = (e) => {
      if (this.ws.readyState == WebSocket.OPEN) {
        this.ws.send(e.data);
      }
    };
    this.recorder.start(timeSlice);
  }

  stop(): void {
    this.recorder?.stop();
    this.ws.send(JSON.stringify({ type: "stop" } as ClientMessage));
  }

  cancel(): void {
    this.recorder?.stop();
    this.ws.send(JSON.stringify({ type: "cancel" } as ClientMessage));
  }
}
