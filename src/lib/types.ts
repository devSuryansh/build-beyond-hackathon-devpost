export type RoomLevel = number & { readonly __brand: "RoomLevel" };

export type Sample = {
  at: number;
  level: RoomLevel;
};

export type SessionSummary = {
  startedAt: number;
  endedAt: number;
  sampleCount: number;
  average: RoomLevel;
  peak: RoomLevel;
  quietShare: number;
  interruptions: number;
};

export type SessionState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number }
  | { kind: "complete"; summary: SessionSummary };

export type SourceMode = "demo" | "live";

export type HeatCell = {
  dayOffset: number;
  hour: number;
  average: RoomLevel | null;
  count: number;
};

export type QuietWindow = {
  startHour: number;
  lengthHours: number;
  average: RoomLevel;
};

export type StoredState = {
  version: 1;
  samples: Sample[];
  sessions: SessionSummary[];
  mode: SourceMode;
  introSeeded: boolean;
};

export const QUIET_MAX = 32;
export const WORKABLE_MAX = 55;
export const INTERRUPT_ENTER = 58;
export const INTERRUPT_EXIT = 42;
export const INTERRUPT_STREAK = 3;
export const MAX_SAMPLES = 8000;
export const STORAGE_KEY = "stillroom.v1";
