import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberPicker } from "./MemberPicker";
import { db } from "@/lib/data";
import { qk, useInvalidate, useSettings } from "@/lib/data/hooks";
import {
  FEE_TYPES,
  PAYMENT_MODES,
  type FeePayment,
  type FeeType,
  type Member,
  type PaymentMode,
} from "@/lib/data/types";
import { defaultPeriod, isoDay, parseAmount } from "@/lib/fees";

interface Draft {
  member_id: string;
  fee_type: FeeType;
  amount: string;
  payment_mode: PaymentMode;
  paid_on: string;
  period: string;
  receipt_number: string;
  notes: string;
}

/** Record a new fee payment or edit an existing one. */
export function FeeDialog({
  open,
  onOpenChange,
  members,
  editing,
  presetMemberId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  members: Member[];
  editing: FeePayment | null;
  presetMemberId?: string;
}) {
  const settings = useSettings();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Draft | null>(null);
  const defaults = settings.data?.fee_defaults ?? {};

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setD({ ...editing, amount: String(editing.amount) });
    } else {
      const today = isoDay(new Date());
      setD({
        member_id: presetMemberId ?? "",
        fee_type: "Annual",
        amount: defaults.Annual ? String(defaults.Annual) : "",
        payment_mode: "Cash",
        paid_on: today,
        period: defaultPeriod("Annual", today),
        receipt_number: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetMemberId]);

  function setType(t: FeeType) {
    if (!d) return;
    const prevDefault = defaults[d.fee_type];
    const amountUntouched =
      !d.amount || (prevDefault !== undefined && d.amount === String(prevDefault));
    setD({
      ...d,
      fee_type: t,
      amount: amountUntouched ? (defaults[t] ? String(defaults[t]) : "") : d.amount,
      period: defaultPeriod(t, d.paid_on),
    });
  }

  async function save() {
    if (!d) return;
    if (!d.member_id) return void toast.error("Choose a member");
    const amount = parseAmount(d.amount);
    if (amount === null) return void toast.error("Enter an amount between ₹1 and ₹10,00,000");
    if (!d.paid_on) return void toast.error("Enter the payment date");
    if (d.fee_type === "Annual" && !/^\d{4}$/.test(d.period))
      return void toast.error("Enter the year this annual fee is for, e.g. 2026");
    setBusy(true);
    try {
      const input = {
        member_id: d.member_id,
        amount,
        fee_type: d.fee_type,
        payment_mode: d.payment_mode,
        paid_on: d.paid_on,
        period: d.period.trim(),
        receipt_number: d.receipt_number.trim().slice(0, 30),
        notes: d.notes.trim().slice(0, 300),
      };
      const saved = editing ? await db.fees.update(editing.id, input) : await db.fees.create(input);
      await invalidate(qk.fees, qk.audit);
      toast.success(
        editing ? "Payment updated" : `Payment saved · receipt ${saved.receipt_number}`,
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit payment" : "Record fee payment"}</DialogTitle>
          <DialogDescription>
            Amounts are in rupees. Leave the receipt number blank to number it automatically.
          </DialogDescription>
        </DialogHeader>
        {d && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="fee-member">Member</Label>
              <MemberPicker
                id="fee-member"
                members={members}
                value={d.member_id}
                disabled={!!presetMemberId || !!editing}
                onChange={(m) => setD({ ...d, member_id: m.id })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fee type</Label>
                <Select value={d.fee_type} onValueChange={(v) => setType(v as FeeType)}>
                  <SelectTrigger className="mt-1.5" aria-label="Fee type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "Registration"
                          ? "Registration (joining)"
                          : t === "Annual"
                            ? "Annual (yearly)"
                            : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fee-amount">Amount (₹)</Label>
                <Input
                  id="fee-amount"
                  inputMode="numeric"
                  className="mt-1.5"
                  value={d.amount}
                  onChange={(e) => setD({ ...d, amount: e.target.value.replace(/[^\d]/g, "") })}
                />
              </div>
              <div>
                <Label htmlFor="fee-date">Paid on</Label>
                <Input
                  id="fee-date"
                  type="date"
                  className="mt-1.5"
                  value={d.paid_on}
                  onChange={(e) =>
                    setD({
                      ...d,
                      paid_on: e.target.value,
                      period: d.period || defaultPeriod(d.fee_type, e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Payment mode</Label>
                <Select
                  value={d.payment_mode}
                  onValueChange={(v) => setD({ ...d, payment_mode: v as PaymentMode })}
                >
                  <SelectTrigger className="mt-1.5" aria-label="Payment mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fee-period">
                  {d.fee_type === "Annual"
                    ? "For year"
                    : d.fee_type === "Monthly"
                      ? "For month (yyyy-mm)"
                      : "For (optional)"}
                </Label>
                <Input
                  id="fee-period"
                  className="mt-1.5"
                  maxLength={20}
                  value={d.period}
                  onChange={(e) => setD({ ...d, period: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fee-receipt">Receipt no.</Label>
                <Input
                  id="fee-receipt"
                  className="mt-1.5"
                  maxLength={30}
                  placeholder="Auto"
                  value={d.receipt_number}
                  onChange={(e) => setD({ ...d, receipt_number: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fee-notes">Notes (optional)</Label>
              <Textarea
                id="fee-notes"
                className="mt-1.5"
                rows={2}
                maxLength={300}
                value={d.notes}
                onChange={(e) => setD({ ...d, notes: e.target.value })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="navy" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
