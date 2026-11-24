import type { FeePayment, FeeType, Member } from "@/lib/data/types";

export type RangePreset = "all" | "today" | "month" | "last_month" | "year" | "fy" | "custom";

export const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "year", label: "This year (Jan–Dec)" },
  { value: "fy", label: "This financial year (Apr–Mar)" },
  { value: "custom", label: "Custom dates" },
];

/** Inclusive yyyy-mm-dd range. null = open-ended. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function presetRange(
  preset: RangePreset,
  today: Date = new Date(),
  custom: DateRange = { from: null, to: null },
): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (preset) {
    case "today":
      return { from: isoDay(today), to: isoDay(today) };
    case "month":
      return { from: isoDay(new Date(y, m, 1)), to: isoDay(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "fy": {
      const start = m >= 3 ? y : y - 1; // Indian financial year starts 1 April
      return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
    }
    case "custom":
      return { from: custom.from || null, to: custom.to || null };
    default:
      return { from: null, to: null };
  }
}

export function inRange(date: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!date) return false;
  const d = date.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function sumAmounts(list: Array<Pick<FeePayment, "amount">>): number {
  return list.reduce((t, p) => t + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function totalsByType(
  list: FeePayment[],
): Array<{ type: FeeType; total: number; count: number }> {
  const map = new Map<FeeType, { total: number; count: number }>();
  for (const p of list) {
    const cur = map.get(p.fee_type) ?? { total: 0, count: 0 };
    cur.total += p.amount;
    cur.count += 1;
    map.set(p.fee_type, cur);
  }
  return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total);
}

/** Next receipt number after the highest existing "R-0007"-style number. */
export function nextReceiptNumber(existing: string[]): string {
  let max = 0;
  for (const r of existing) {
    const m = /^R-(\d+)$/i.exec(r.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `R-${String(max + 1).padStart(4, "0")}`;
}

/** Members (not archived) with no Annual fee recorded for the given year. */
export function membersWithPendingAnnualFee(
  members: Member[],
  payments: FeePayment[],
  year: string,
): Member[] {
  const paid = new Set(
    payments.filter((p) => p.fee_type === "Annual" && p.period === year).map((p) => p.member_id),
  );
  return members.filter((m) => m.status !== "archived" && !paid.has(m.id));
}

export function hasPaidAnnual(memberId: string, payments: FeePayment[], year: string): boolean {
  return payments.some(
    (p) => p.member_id === memberId && p.fee_type === "Annual" && p.period === year,
  );
}

/** Validates an amount typed by an admin: whole rupees, 1 – 10,00,000. */
export function parseAmount(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n);
}

export function defaultPeriod(type: FeeType, paidOn: string): string {
  if (type === "Annual") return paidOn.slice(0, 4);
  if (type === "Monthly") return paidOn.slice(0, 7);
  return "";
}
