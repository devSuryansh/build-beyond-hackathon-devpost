import { roomLevel } from "./level";
import { mulberry32 } from "./rng";
import type { RoomLevel, Sample } from "./types";

function hourProfile(hour: number, weekday: number): { base: number; swing: number } {
  const weekend = weekday === 0 || weekday === 6;
  if (hour >= 0 && hour < 6) return { base: weekend ? 18 : 14, swing: 8 };
  if (hour >= 6 && hour < 8) return { base: 28, swing: 12 };
  if (hour >= 8 && hour < 12) return { base: weekend ? 24 : 36, swing: 16 };
  if (hour >= 12 && hour < 17) return { base: weekend ? 32 : 30, swing: 18 };
  if (hour >= 17 && hour < 20) return { base: weekend ? 58 : 48, swing: 18 };
  if (hour >= 20 && hour < 23) return { base: weekend ? 72 : 54, swing: 16 };
  return { base: weekend ? 64 : 40, swing: 14 };
}

export function demoLevelAt(params: {
  at: number;
  seed: number;
}): RoomLevel {
  const { at, seed } = params;
  const date = new Date(at);
  const hour = date.getHours();
  const weekday = date.getDay();
  const { base, swing } = hourProfile(hour, weekday);
  const rand = mulberry32(seed + Math.floor(at / 250));
  const wobble = (rand() - 0.5) * swing;
  const spike = rand() > 0.97 ? 20 + rand() * 25 : 0;
  return roomLevel(base + wobble + spike);
}

export function buildSampleWeek(params: {
  now: number;
  seed: number;
}): Sample[] {
  const { now, seed } = params;
  const samples: Sample[] = [];
  const start = now - 7 * 24 * 60 * 60 * 1000;
  for (let t = start; t < now; t += 6 * 60 * 1000) {
    samples.push({ at: t, level: demoLevelAt({ at: t, seed }) });
  }
  return samples;
}
