import { buildSampleWeek, demoLevelAt } from "./lib/demo";
import {
  dayLabel,
  formatDuration,
  formatHourRange,
  formatPercent,
} from "./lib/format";
import { buildHeatmap, quietestWindows } from "./lib/heatmap";
import { levelLabel } from "./lib/level";
import { startLiveMeter, type MeterHandle } from "./lib/live";
import { addSample, finishSession, startSession, type SessionAccumulator } from "./lib/session";
import { appendSamples, loadState, saveState } from "./lib/store";
import type { HeatCell, RoomLevel, Sample, SessionSummary, SourceMode, StoredState } from "./lib/types";
import { QUIET_MAX, WORKABLE_MAX } from "./lib/types";

const SEED = 42;
const TRACE_POINTS = 96;
const HEAT_EVERY = 60;

function requireElement(id: string): Element {
  const el = document.querySelector(`#${CSS.escape(id)}`);
  if (el === null) {
    throw new Error(`Missing #${id}`);
  }
  return el;
}

function mustHtml(id: string): HTMLElement {
  const el = requireElement(id);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Missing HTML #${id}`);
  }
  return el;
}

function setRotate(el: Element, deg: number): void {
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    el.style.transform = `rotate(${deg}deg)`;
  }
}

function mustButton(id: string): HTMLButtonElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Missing button #${id}`);
  }
  return el;
}

function mustCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`Missing canvas #${id}`);
  }
  return el;
}

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function heatColor(level: RoomLevel): string {
  const quiet = [125, 154, 106];
  const ok = [212, 162, 74];
  const loud = [196, 92, 62];
  const from = level <= WORKABLE_MAX ? quiet : ok;
  const to = level <= WORKABLE_MAX ? ok : loud;
  const start = level <= WORKABLE_MAX ? 0 : WORKABLE_MAX;
  const end = level <= WORKABLE_MAX ? WORKABLE_MAX : 100;
  const t = (level - start) / (end - start);
  const r = mix(from[0] ?? 0, to[0] ?? 0, t);
  const g = mix(from[1] ?? 0, to[1] ?? 0, t);
  const b = mix(from[2] ?? 0, to[2] ?? 0, t);
  return `rgb(${r} ${g} ${b})`;
}

function needleAngle(level: RoomLevel): number {
  return -90 + (level / 100) * 180;
}

const ui = {
  levelNum: mustHtml("level-num"),
  levelLabel: mustHtml("level-label"),
  needle: requireElement("needle"),
  duration: mustHtml("stat-duration"),
  average: mustHtml("stat-avg"),
  quiet: mustHtml("stat-quiet"),
  cuts: mustHtml("stat-cuts"),
  toggle: mustButton("session-toggle"),
  windows: mustHtml("window-list"),
  heatmap: mustHtml("heatmap"),
  caption: mustHtml("heat-caption"),
  log: mustHtml("session-log"),
  note: mustHtml("mode-note"),
  demo: mustButton("mode-demo"),
  live: mustButton("mode-live"),
  seed: mustButton("seed-week"),
  clear: mustButton("clear-data"),
  trace: mustCanvas("trace"),
};

let state: StoredState = loadState(localStorage);
let acc: SessionAccumulator | null = null;
let demoTimer: number | null = null;
let liveMeter: MeterHandle | null = null;
const trace: RoomLevel[] = [];

function persist(): void {
  saveState(localStorage, state);
}

function withIntroSeed(loaded: StoredState): StoredState {
  if (loaded.introSeeded) return loaded;
  return {
    ...loaded,
    samples: buildSampleWeek({ now: Date.now(), seed: SEED }),
    introSeeded: true,
    mode: "demo",
  };
}

function setModeButtons(mode: SourceMode): void {
  ui.demo.classList.toggle("is-on", mode === "demo");
  ui.live.classList.toggle("is-on", mode === "live");
}

function paintTrace(): void {
  const ctx = ui.trace.getContext("2d");
  if (!ctx) return;
  const { width, height } = ui.trace;
  ctx.fillStyle = "#140f0c";
  ctx.fillRect(0, 0, width, height);
  const bar = width / TRACE_POINTS;
  trace.forEach((level, i) => {
    const h = Math.max(2, (level / 100) * (height - 12));
    ctx.fillStyle = heatColor(level);
    ctx.fillRect(i * bar, height - h, Math.max(1, bar - 1), h);
  });
}

function renderMeter(level: RoomLevel): void {
  ui.levelNum.textContent = String(Math.round(level)).padStart(2, "0");
  const label = levelLabel(level);
  ui.levelLabel.textContent = label;
  ui.levelLabel.classList.toggle("is-loud", label === "loud");
  ui.levelLabel.classList.toggle("is-quiet", label === "quiet");
  setRotate(ui.needle, needleAngle(level));
}

function renderSessionStats(): void {
  if (!acc) {
    ui.duration.textContent = "0s";
    ui.average.textContent = "—";
    ui.quiet.textContent = "—";
    ui.cuts.textContent = "0";
    ui.toggle.textContent = "Start focus session";
    return;
  }
  const summary = finishSession({ acc, endedAt: Date.now() });
  ui.duration.textContent = formatDuration(summary.endedAt - summary.startedAt);
  ui.average.textContent = String(Math.round(summary.average));
  ui.quiet.textContent = formatPercent(summary.quietShare);
  ui.cuts.textContent = String(summary.interruptions);
  ui.toggle.textContent = "End session";
}

function renderWindows(cells: HeatCell[]): void {
  const windows = quietestWindows({ cells, lengthHours: 2, limit: 3 });
  ui.windows.replaceChildren();
  if (windows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Log a session or load the sample week to see quiet blocks.";
    ui.windows.append(empty);
    return;
  }
  for (const window of windows) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = formatHourRange(window.startHour, window.lengthHours);
    const meta = document.createElement("span");
    const quality =
      window.average <= QUIET_MAX
        ? "usually quiet"
        : window.average <= WORKABLE_MAX
          ? "usually workable"
          : "least loud, still noisy";
    meta.textContent = `avg ${Math.round(window.average)} · ${quality}`;
    li.append(title, meta);
    ui.windows.append(li);
  }
}

function renderHeatmap(cells: HeatCell[], now: number): void {
  ui.heatmap.replaceChildren();
  const hourRow = document.createElement("div");
  hourRow.className = "heat-label";
  hourRow.textContent = "";
  ui.heatmap.append(hourRow);
  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement("div");
    label.className = "heat-label";
    label.textContent = hour % 3 === 0 ? String(hour) : "";
    ui.heatmap.append(label);
  }
  for (let day = 0; day < 7; day += 1) {
    const name = document.createElement("div");
    name.className = "heat-label";
    name.textContent = dayLabel(day, now);
    ui.heatmap.append(name);
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = cells.find((c) => c.dayOffset === day && c.hour === hour);
      const swatch = document.createElement("div");
      swatch.className = "heat-cell";
      if (cell && cell.average !== null) {
        swatch.classList.add("has-data");
        swatch.style.background = heatColor(cell.average);
        swatch.title = `${dayLabel(day, now)} ${hour}:00 · ${Math.round(cell.average)}`;
      }
      ui.heatmap.append(swatch);
    }
  }
  const filled = cells.filter((c) => c.count > 0).length;
  ui.caption.textContent = `${filled} hour-slots measured in the last 7 days. Dark cells have no samples yet.`;
}

function renderLog(sessions: readonly SessionSummary[]): void {
  ui.log.replaceChildren();
  if (sessions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No focus sessions yet.";
    ui.log.append(empty);
    return;
  }
  for (const session of [...sessions].reverse().slice(0, 12)) {
    const li = document.createElement("li");
    const when = new Date(session.startedAt).toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    li.innerHTML = "";
    const cells = [
      when,
      formatDuration(session.endedAt - session.startedAt),
      `avg ${Math.round(session.average)}`,
      `${session.interruptions} cuts`,
    ];
    for (const text of cells) {
      const span = document.createElement("span");
      span.textContent = text;
      li.append(span);
    }
    ui.log.append(li);
  }
}

function renderAll(): void {
  const now = Date.now();
  const cells = buildHeatmap({ samples: state.samples, now });
  renderWindows(cells);
  renderHeatmap(cells, now);
  renderLog(state.sessions);
  setModeButtons(state.mode);
}

function onLevel(level: RoomLevel): void {
  trace.push(level);
  if (trace.length > TRACE_POINTS) trace.shift();
  renderMeter(level);
  paintTrace();

  if (!acc) {
    renderSessionStats();
    return;
  }

  const sample: Sample = { at: Date.now(), level };
  acc = addSample(acc, sample);
  if (acc.samples.length % HEAT_EVERY === 0) {
    state = appendSamples(state, [sample]);
    persist();
    renderAll();
  }
  renderSessionStats();
}

function stopDemo(): void {
  if (demoTimer !== null) {
    window.clearInterval(demoTimer);
    demoTimer = null;
  }
}

function stopLive(): void {
  liveMeter?.stop();
  liveMeter = null;
}

function startDemoLoop(): void {
  stopDemo();
  stopLive();
  demoTimer = window.setInterval(() => {
    onLevel(demoLevelAt({ at: Date.now(), seed: SEED }));
  }, 250);
  ui.note.textContent =
    "Demo mode plays a generated hostel week so you can use the app without a mic.";
}

async function startLiveLoop(): Promise<void> {
  stopDemo();
  stopLive();
  try {
    liveMeter = await startLiveMeter({ onLevel });
    ui.note.textContent =
      "Live mode uses this device microphone. Audio never leaves the browser.";
  } catch {
    state = { ...state, mode: "demo" };
    persist();
    setModeButtons("demo");
    startDemoLoop();
    ui.note.textContent =
      "Microphone permission was denied, so Stillroom stayed in demo mode.";
  }
}

function applySource(): void {
  if (state.mode === "live") void startLiveLoop();
  else startDemoLoop();
}

ui.demo.addEventListener("click", () => {
  state = { ...state, mode: "demo" };
  persist();
  setModeButtons("demo");
  startDemoLoop();
});

ui.live.addEventListener("click", () => {
  state = { ...state, mode: "live" };
  persist();
  setModeButtons("live");
  void startLiveLoop();
});

ui.toggle.addEventListener("click", () => {
  if (acc) {
    const summary = finishSession({ acc, endedAt: Date.now() });
    state = {
      ...state,
      sessions: [...state.sessions, summary],
      samples: appendSamples(state, acc.samples.filter((_, i) => i % HEAT_EVERY === 0)).samples,
    };
    acc = null;
    persist();
    renderAll();
    renderSessionStats();
    return;
  }
  acc = startSession(Date.now());
  renderSessionStats();
});

ui.seed.addEventListener("click", () => {
  state = {
    ...state,
    samples: buildSampleWeek({ now: Date.now(), seed: SEED }),
    introSeeded: true,
  };
  persist();
  renderAll();
});

ui.clear.addEventListener("click", () => {
  state = {
    ...state,
    samples: [],
    sessions: [],
    introSeeded: true,
  };
  persist();
  renderAll();
  renderSessionStats();
});

state = withIntroSeed(state);
persist();
renderAll();
renderSessionStats();
applySource();
