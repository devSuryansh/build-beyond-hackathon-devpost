import {
  dayLabel,
  formatDuration,
  formatHourRange,
  formatPercent,
} from "./lib/format";
import { buildHeatmap, quietestWindows } from "./lib/heatmap";
import { levelLabel, roomLevel } from "./lib/level";
import { startLiveMeter, type MeterHandle } from "./lib/live";
import { addSample, finishSession, startSession, type SessionAccumulator } from "./lib/session";
import { appendSamples, loadState, saveState } from "./lib/store";
import type { HeatCell, RoomLevel, Sample, SessionSummary, StoredState } from "./lib/types";
import { QUIET_MAX, WORKABLE_MAX } from "./lib/types";

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
  if (el instanceof SVGGraphicsElement) {
    el.setAttribute("transform", `rotate(${deg} 140 108)`);
    return;
  }
  if (el instanceof HTMLElement) {
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
  listen: mustButton("listen"),
  clear: mustButton("clear-data"),
  trace: mustCanvas("trace"),
};

const METER_EASE = 0.16;
const METER_SNAP = 0.2;

let state: StoredState = loadState(localStorage);
let acc: SessionAccumulator | null = null;
let liveMeter: MeterHandle | null = null;
let targetLevel = 0;
let displayedLevel = 0;
let meterFrame: number | null = null;
const trace: RoomLevel[] = [];

function persist(): void {
  saveState(localStorage, state);
}

function setListenButton(on: boolean): void {
  ui.listen.classList.toggle("is-on", on);
  ui.listen.setAttribute("aria-pressed", String(on));
  ui.listen.textContent = on ? "Stop microphone" : "Use microphone";
  document.body.classList.toggle("is-listening", on);
}

function paintTrace(): void {
  const ctx = ui.trace.getContext("2d");
  if (!ctx) return;
  const { width, height } = ui.trace;
  ctx.fillStyle = "#101114";
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

function tickMeter(): void {
  const delta = targetLevel - displayedLevel;
  if (Math.abs(delta) <= METER_SNAP) {
    displayedLevel = targetLevel;
    renderMeter(roomLevel(displayedLevel));
    meterFrame = null;
    return;
  }
  displayedLevel += delta * METER_EASE;
  renderMeter(roomLevel(displayedLevel));
  meterFrame = window.requestAnimationFrame(tickMeter);
}

function setMeterTarget(level: number): void {
  targetLevel = roomLevel(level);
  if (meterFrame === null) {
    meterFrame = window.requestAnimationFrame(tickMeter);
  }
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
    empty.textContent = "Log a focus session to see quiet blocks.";
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
}

function onLevel(level: RoomLevel): void {
  trace.push(level);
  if (trace.length > TRACE_POINTS) trace.shift();
  setMeterTarget(level);
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

function stopListening(): void {
  liveMeter?.stop();
  liveMeter = null;
  setListenButton(false);
  setMeterTarget(0);
  ui.note.textContent =
    "Allow the microphone to measure this room. Audio never leaves the browser.";
}

async function startListening(): Promise<boolean> {
  if (liveMeter) return true;
  try {
    liveMeter = await startLiveMeter({ onLevel });
    setListenButton(true);
    ui.note.textContent =
      "Listening on this device. Audio never leaves the browser.";
    return true;
  } catch {
    stopListening();
    ui.note.textContent =
      "Microphone permission was denied. Allow it in the browser to measure this room.";
    return false;
  }
}

ui.listen.addEventListener("click", () => {
  if (liveMeter) stopListening();
  else void startListening();
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
    stopListening();
    return;
  }
  void startListening().then((ok) => {
    if (!ok) return;
    acc = startSession(Date.now());
    renderSessionStats();
  });
});

ui.clear.addEventListener("click", () => {
  state = {
    ...state,
    samples: [],
    sessions: [],
  };
  persist();
  renderAll();
  renderSessionStats();
});

renderAll();
renderSessionStats();
renderMeter(roomLevel(0));
setListenButton(false);
