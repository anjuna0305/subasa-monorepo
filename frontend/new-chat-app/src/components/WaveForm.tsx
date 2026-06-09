import WavesurferPlayer from "@wavesurfer/react";
import { useState } from "react";

export default function WaveForm() {
  const [wavesurfer, setWavesurfer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // const onReady = (ws) => {
  //   setWavesurfer(ws);
  //   setIsPlaying(false);
  // };

  // const onPlayPause = () => {
  //   wavesurfer && wavesurfer.playPause();
  // };

  return (
    <>
      <WavesurferPlayer
        height={100}
        waveColor="violet"
        url="/my-server/audio.wav"
        // onReady={onReady}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <button>{isPlaying ? "Pause" : "Play"}</button>
    </>
  );
}
