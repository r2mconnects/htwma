import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import type { FeePayment, Member } from "@/lib/data/types";
import {
  inRange,
  membersWithPendingAnnualFee,
  nextReceiptNumber,
  parseAmount,
  presetRange,
  sumAmounts,
} from "@/lib/fees";

const pay = (p: Partial<FeePayment>): FeePayment => ({
  id: "p",
  member_id: "m1",
  amount: 199,
  fee_type: "Annual",
  payment_mode: "Cash",
  paid_on: "2026-11-10",
  period: "2026",
  receipt_number: "R-0001",
  notes: "",
  is_demo: false,
  created_at: "",
  ...p,
});
const member = (id: string, status: Member["status"] = "active") => ({ id, status }) as Member;

describe("fee rules", () => {
  it("joining and yearly fees default to ₹199", () => {
    expect(DEFAULT_SETTINGS.fee_defaults.Registration).toBe(199);
    expect(DEFAULT_SETTINGS.fee_defaults.Annual).toBe(199);
  });

  it("adds up payment amounts for the dashboard total", () => {
    expect(sumAmounts([pay({ amount: 199 }), pay({ amount: 199 }), pay({ amount: 500 })])).toBe(
      898,
    );
  });

  it("this month covers the 1st to the last day", () => {
    expect(presetRange("month", new Date(2026, 10, 23))).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("financial year runs April to March", () => {
    expect(presetRange("fy", new Date(2026, 1, 5))).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    });
    expect(presetRange("fy", new Date(2026, 10, 5))).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    });
  });

  it("date filter includes both end dates", () => {
    const r = { from: "2026-11-01", to: "2026-11-30" };
    expect(inRange("2026-11-30", r)).toBe(true);
    expect(inRange("2026-12-01", r)).toBe(false);
  });

  it("numbers receipts after the highest existing one", () => {
    expect(nextReceiptNumber(["R-0003", "R-0010", "manual-7"])).toBe("R-0011");
    expect(nextReceiptNumber([])).toBe("R-0001");
  });

  it("rejects zero or negative amounts", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("₹1,999")).toBe(1999);
  });

  it("lists members without a yearly fee for the year, ignoring archived", () => {
    const members = [member("m1"), member("m2"), member("m3", "archived")];
    const pending = membersWithPendingAnnualFee(
      members,
      [pay({ member_id: "m1", period: "2026" })],
      "2026",
    );
    expect(pending.map((m) => m.id)).toEqual(["m2"]);
  });
});
