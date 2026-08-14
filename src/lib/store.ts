import { roomLevel } from "./level";
import {
  MAX_SAMPLES,
  STORAGE_KEY,
  type Sample,
  type SessionSummary,
  type SourceMode,
  type StoredState,
} from "./types";

export const emptyState = (): StoredState => ({
  version: 1,
  samples: [],
  sessions: [],
  mode: "demo",
  introSeeded: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSample(value: unknown): Sample | null {
  if (!isRecord(value)) return null;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return null;
  if (typeof value.level !== "number" || !Number.isFinite(value.level)) return null;
  return { at: value.at, level: roomLevel(value.level) };
}

function parseSession(value: unknown): SessionSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.startedAt !== "number") return null;
  if (typeof value.endedAt !== "number") return null;
  if (typeof value.sampleCount !== "number") return null;
  if (typeof value.average !== "number") return null;
  if (typeof value.peak !== "number") return null;
  if (typeof value.quietShare !== "number") return null;
  if (typeof value.interruptions !== "number") return null;
  return {
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    sampleCount: value.sampleCount,
    average: roomLevel(value.average),
    peak: roomLevel(value.peak),
    quietShare: Math.min(1, Math.max(0, value.quietShare)),
    interruptions: Math.max(0, Math.floor(value.interruptions)),
  };
}

export function parseStored(raw: unknown): StoredState {
  if (!isRecord(raw) || raw.version !== 1) return emptyState();
  const samples: Sample[] = [];
  if (Array.isArray(raw.samples)) {
    for (const item of raw.samples) {
      const sample = parseSample(item);
      if (sample) samples.push(sample);
    }
  }
  const sessions: SessionSummary[] = [];
  if (Array.isArray(raw.sessions)) {
    for (const item of raw.sessions) {
      const session = parseSession(item);
      if (session) sessions.push(session);
    }
  }
  const mode: SourceMode = raw.mode === "live" ? "live" : "demo";
  return {
    version: 1,
    samples: samples.slice(-MAX_SAMPLES),
    sessions: sessions.slice(-50),
    mode,
    introSeeded: raw.introSeeded === true,
  };
}

export function loadState(storage: Storage): StoredState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    return parseStored(JSON.parse(raw) as unknown);
  } catch {
    return emptyState();
  }
}

export function saveState(storage: Storage, state: StoredState): void {
  const trimmed: StoredState = {
    ...state,
    samples: state.samples.slice(-MAX_SAMPLES),
    sessions: state.sessions.slice(-50),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function appendSamples(
  state: StoredState,
  incoming: readonly Sample[],
): StoredState {
  return {
    ...state,
    samples: [...state.samples, ...incoming].slice(-MAX_SAMPLES),
  };
}
