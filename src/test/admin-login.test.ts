import { beforeEach, describe, expect, it } from "vitest";
import { createLocalProvider } from "@/lib/data/local/local-provider";

describe("built-in admin login (browser storage mode)", () => {
  beforeEach(() => localStorage.clear());

  it("signs in with htwma@gmail.com and HTWMA@2026", async () => {
    const db = createLocalProvider();
    const session = await db.auth.signIn("HTWMA@gmail.com", "HTWMA@2026");
    expect(session.email).toBe("htwma@gmail.com");
    expect(await db.auth.getSession()).not.toBeNull();
  }, 20000);

  it("rejects a wrong password", async () => {
    const db = createLocalProvider();
    await expect(db.auth.signIn("htwma@gmail.com", "wrong-password")).rejects.toThrow("Incorrect email or password.");
  }, 20000);

  it("records a fee with an automatic receipt number", async () => {
    const db = createLocalProvider();
    await db.auth.signIn("htwma@gmail.com", "HTWMA@2026");
    const member = (await db.members.list())[0]!;
    const before = await db.fees.list();
    const p = await db.fees.create({
      member_id: member.id, amount: 199, fee_type: "Annual", payment_mode: "Cash",
      paid_on: "2026-11-23", period: "2026", receipt_number: "", notes: "",
    });
    expect(p.receipt_number).toMatch(/^R-\d{4}$/);
    expect((await db.fees.list()).length).toBe(before.length + 1);
  }, 20000);
});
