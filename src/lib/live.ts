import { rmsToLevel } from "./level";
import type { RoomLevel } from "./types";

export type MeterHandle = {
  stop: () => void;
};

function rmsFromTimeDomain(buffer: Uint8Array): number {
  let sum = 0;
  for (const value of buffer) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / buffer.length);
}

export async function startLiveMeter(params: {
  onLevel: (level: RoomLevel) => void;
  intervalMs?: number;
}): Promise<MeterHandle> {
  const intervalMs = params.intervalMs ?? 250;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const buffer = new Uint8Array(analyser.fftSize);

  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(buffer);
    params.onLevel(rmsToLevel(rmsFromTimeDomain(buffer)));
  }, intervalMs);

  return {
    stop: () => {
      window.clearInterval(timer);
      source.disconnect();
      void ctx.close();
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
