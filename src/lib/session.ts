import { meanLevel, peakLevel, roomLevel } from "./level";
import {
  INTERRUPT_ENTER,
  INTERRUPT_EXIT,
  INTERRUPT_STREAK,
  QUIET_MAX,
  type RoomLevel,
  type Sample,
  type SessionSummary,
} from "./types";

export type SessionAccumulator = {
  startedAt: number;
  samples: Sample[];
  loudStreak: number;
  inInterruption: boolean;
  interruptions: number;
};

export function startSession(at: number): SessionAccumulator {
  return {
    startedAt: at,
    samples: [],
    loudStreak: 0,
    inInterruption: false,
    interruptions: 0,
  };
}

export function addSample(
  acc: SessionAccumulator,
  sample: Sample,
): SessionAccumulator {
  acc.samples.push(sample);

  if (sample.level >= INTERRUPT_ENTER) {
    const loudStreak = acc.loudStreak + 1;
    if (!acc.inInterruption && loudStreak >= INTERRUPT_STREAK) {
      return {
        ...acc,
        loudStreak,
        inInterruption: true,
        interruptions: acc.interruptions + 1,
      };
    }
    return { ...acc, loudStreak };
  }

  const next = { ...acc, loudStreak: 0 };
  if (acc.inInterruption && sample.level <= INTERRUPT_EXIT) {
    return { ...next, inInterruption: false };
  }
  return next;
}

export function finishSession(params: {
  acc: SessionAccumulator;
  endedAt: number;
}): SessionSummary {
  const levels = params.acc.samples.map((s) => s.level);
  const quietCount = levels.filter((level) => level <= QUIET_MAX).length;
  const average = meanLevel(levels);
  const peak = peakLevel(levels);

  return {
    startedAt: params.acc.startedAt,
    endedAt: params.endedAt,
    sampleCount: params.acc.samples.length,
    average: average ?? roomLevel(0),
    peak: peak ?? roomLevel(0),
    quietShare: levels.length === 0 ? 0 : quietCount / levels.length,
    interruptions: params.acc.interruptions,
  };
}

export function sessionDurationMs(summary: SessionSummary): number {
  return Math.max(0, summary.endedAt - summary.startedAt);
}

export function isQuietEnough(level: RoomLevel): boolean {
  return level <= QUIET_MAX;
}
