import { QUIET_MAX, WORKABLE_MAX, type RoomLevel } from "./types";

export function roomLevel(value: number): RoomLevel {
  const finite = Number.isFinite(value) ? value : 0;
  const clamped = Math.min(100, Math.max(0, finite));
  return clamped as RoomLevel;
}

export function rmsToLevel(rms: number): RoomLevel {
  const safe = Math.max(rms, 1e-6);
  const db = 20 * Math.log10(safe);
  const minDb = -55;
  const maxDb = -8;
  const t = (db - minDb) / (maxDb - minDb);
  return roomLevel(t * 100);
}

export function levelLabel(level: RoomLevel): "quiet" | "workable" | "loud" {
  if (level <= QUIET_MAX) return "quiet";
  if (level <= WORKABLE_MAX) return "workable";
  return "loud";
}

export function meanLevel(levels: readonly RoomLevel[]): RoomLevel | null {
  if (levels.length === 0) return null;
  const total = levels.reduce((sum, n) => sum + n, 0);
  return roomLevel(total / levels.length);
}

export function peakLevel(levels: readonly RoomLevel[]): RoomLevel | null {
  if (levels.length === 0) return null;
  return roomLevel(Math.max(...levels));
}
