import { Injectable, UnprocessableEntityException } from "@nestjs/common";

export interface LeaveExcludedDate {
  date: string;
  reason: "DAY_OFF" | "PUBLIC_HOLIDAY";
  label: string;
}

export interface LeaveCalculation {
  calendarDays: number;
  workingDays: number;
  annualAllocations: Array<{ year: number; workingDays: number }>;
  excludedDates: LeaveExcludedDate[];
}

@Injectable()
export class LeaveCalculatorService {
  calculate(
    startDate: string,
    endDate: string,
    workingDaysBitmap: number[],
    holidays: Array<{ holidayDate: Date; name: string }>,
    halfDayPeriod = "FULL",
  ): LeaveCalculation {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    if (end < start) throw new UnprocessableEntityException("INVALID_DATE_RANGE");

    const holidayMap = new Map(
      holidays.map((holiday) => [this.toDateString(holiday.holidayDate), holiday.name]),
    );
    const workingSet = new Set(workingDaysBitmap);
    let calendarDays = 0;
    let workingDays = 0;
    const allocations = new Map<number, number>();
    const excludedDates: LeaveExcludedDate[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      calendarDays += 1;
      const dateString = this.toDateString(cursor);
      const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      const holidayName = holidayMap.get(dateString);
      if (holidayName) {
        excludedDates.push({ date: dateString, reason: "PUBLIC_HOLIDAY", label: holidayName });
      } else if (!workingSet.has(isoWeekday)) {
        excludedDates.push({ date: dateString, reason: "DAY_OFF", label: "Day off" });
      } else {
        workingDays += halfDayPeriod === "FULL" ? 1 : 0.5;
        allocations.set(cursor.getUTCFullYear(), (allocations.get(cursor.getUTCFullYear()) ?? 0) + (halfDayPeriod === "FULL" ? 1 : 0.5));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (halfDayPeriod !== "FULL" && (startDate !== endDate || workingDays === 0)) {
      throw new UnprocessableEntityException("HALF_DAY_SINGLE_WORKDAY_REQUIRED");
    }
    if (workingDays === 0) throw new UnprocessableEntityException("ZERO_WORKING_DAYS");

    return {
      calendarDays,
      workingDays,
      annualAllocations: [...allocations.entries()]
        .sort(([yearA], [yearB]) => yearA - yearB)
        .map(([year, days]) => ({ year, workingDays: days })),
      excludedDates,
    };
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new UnprocessableEntityException("INVALID_DATE");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.valueOf()) || this.toDateString(date) !== value) {
      throw new UnprocessableEntityException("INVALID_DATE");
    }
    return date;
  }

  private toDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
