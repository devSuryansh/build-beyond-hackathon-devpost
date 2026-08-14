export function formatHour(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const suffix = wrapped < 12 ? "am" : "pm";
  const twelve = wrapped % 12 === 0 ? 12 : wrapped % 12;
  return `${twelve}${suffix}`;
}

export function formatHourRange(startHour: number, lengthHours: number): string {
  return `${formatHour(startHour)} to ${formatHour(startHour + lengthHours)}`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function dayLabel(dayOffset: number, now: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === 1) return "Yesterday";
  const date = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString(undefined, { weekday: "short" });
}
