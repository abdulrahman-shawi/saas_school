import { Weekday } from "@prisma/client";

export const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string }> = [
  { value: Weekday.SUNDAY, label: "الأحد" },
  { value: Weekday.MONDAY, label: "الاثنين" },
  { value: Weekday.TUESDAY, label: "الثلاثاء" },
  { value: Weekday.WEDNESDAY, label: "الأربعاء" },
  { value: Weekday.THURSDAY, label: "الخميس" },
  { value: Weekday.FRIDAY, label: "الجمعة" },
  { value: Weekday.SATURDAY, label: "السبت" },
];

export const WEEKDAY_LABELS: Record<Weekday, string> = Object.fromEntries(
  WEEKDAY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Weekday, string>;

export function isValidTimeRange(startTime: string, endTime: string): boolean {
  return startTime < endTime;
}