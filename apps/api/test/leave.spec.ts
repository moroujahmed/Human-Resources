import { describe, expect, it } from "vitest";
import { LeaveCalculatorService } from "../src/leave/leave-calculator.service";

describe("Uganda leave working-day calculator", () => {
  const calculator = new LeaveCalculatorService();
  const weekdays = [1, 2, 3, 4, 5];

  it("counts a Monday-Friday range", () => {
    const result = calculator.calculate("2026-11-16", "2026-11-20", weekdays, []);
    expect(result.calendarDays).toBe(5);
    expect(result.workingDays).toBe(5);
  });

  it("skips weekends and public holidays", () => {
    const result = calculator.calculate(
      "2026-12-24",
      "2026-12-28",
      weekdays,
      [{ holidayDate: new Date("2026-12-25T00:00:00.000Z"), name: "Christmas Day" }],
    );
    expect(result.calendarDays).toBe(5);
    expect(result.workingDays).toBe(2);
  });

  it("rejects a weekend-only range", () => {
    expect(() => calculator.calculate("2026-11-21", "2026-11-22", weekdays, [])).toThrow();
  });

  it("calculates half-day leave on one scheduled work date", () => {
    const result = calculator.calculate("2026-11-18", "2026-11-18", weekdays, [], "MORNING");
    expect(result.workingDays).toBe(0.5);
  });

  it("rejects a half-day across more than one date", () => {
    expect(() => calculator.calculate("2026-11-18", "2026-11-19", weekdays, [], "AFTERNOON")).toThrow();
  });

  it("splits cross-year working days into allocations", () => {
    const result = calculator.calculate("2026-12-31", "2027-01-04", weekdays, []);
    expect(result.annualAllocations).toEqual([
      { year: 2026, workingDays: 1 },
      { year: 2027, workingDays: 2 },
    ]);
  });
});
