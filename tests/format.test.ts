import { describe, expect, it } from "vitest";
import { formatDuration, formatHour, formatHourRange, formatPercent } from "../src/lib/format";

describe("formatHour", () => {
  it("uses 12-hour labels", () => {
    expect(formatHour(0)).toBe("12am");
    expect(formatHour(7)).toBe("7am");
    expect(formatHour(12)).toBe("12pm");
    expect(formatHour(21)).toBe("9pm");
  });
});

describe("formatHourRange", () => {
  it("prints a two-hour block", () => {
    expect(formatHourRange(5, 2)).toBe("5am to 7am");
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(4000)).toBe("4s");
    expect(formatDuration(125000)).toBe("2m 05s");
  });
});

describe("formatPercent", () => {
  it("rounds to a whole percent", () => {
    expect(formatPercent(0.5)).toBe("50%");
  });
});
