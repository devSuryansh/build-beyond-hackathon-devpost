import { meanLevel } from "./level";
import type { HeatCell, QuietWindow, RoomLevel, Sample } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayOffsetFor(at: number, now: number): number {
  const nowDay = startOfLocalDay(now);
  const sampleDay = startOfLocalDay(at);
  return Math.floor((nowDay - sampleDay) / DAY_MS);
}

export function startOfLocalDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildHeatmap(params: {
  samples: readonly Sample[];
  now: number;
  days?: number;
}): HeatCell[] {
  const days = params.days ?? 7;
  const buckets = new Map<string, RoomLevel[]>();

  for (const sample of params.samples) {
    const offset = dayOffsetFor(sample.at, params.now);
    if (offset < 0 || offset >= days) continue;
    const hour = new Date(sample.at).getHours();
    const key = `${offset}:${hour}`;
    const list = buckets.get(key);
    if (list) list.push(sample.level);
    else buckets.set(key, [sample.level]);
  }

  const cells: HeatCell[] = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const levels = buckets.get(`${dayOffset}:${hour}`) ?? [];
      cells.push({
        dayOffset,
        hour,
        average: meanLevel(levels),
        count: levels.length,
      });
    }
  }
  return cells;
}

export function hourlyAverages(cells: readonly HeatCell[]): Array<RoomLevel | null> {
  const byHour: RoomLevel[][] = Array.from({ length: 24 }, () => []);
  for (const cell of cells) {
    if (cell.average === null) continue;
    const bucket = byHour[cell.hour];
    if (bucket) bucket.push(cell.average);
  }
  return byHour.map((levels) => meanLevel(levels));
}

export function quietestWindows(params: {
  cells: readonly HeatCell[];
  lengthHours: number;
  limit: number;
}): QuietWindow[] {
  const { lengthHours, limit } = params;
  if (lengthHours < 1 || lengthHours > 24) return [];

  const hours = hourlyAverages(params.cells);
  const windows: QuietWindow[] = [];

  for (let start = 0; start <= 24 - lengthHours; start += 1) {
    const slice: RoomLevel[] = [];
    let missing = false;
    for (let i = 0; i < lengthHours; i += 1) {
      const value = hours[start + i];
      if (value === undefined || value === null) {
        missing = true;
        break;
      }
      slice.push(value);
    }
    if (missing) continue;
    const average = meanLevel(slice);
    if (average === null) continue;
    windows.push({ startHour: start, lengthHours, average });
  }

  windows.sort((a, b) => a.average - b.average || a.startHour - b.startHour);
  return windows.slice(0, limit);
}
