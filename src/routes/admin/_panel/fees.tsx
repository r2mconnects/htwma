import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IndianRupee,
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  ReceiptIndianRupee,
  BellRing,
} from "lucide-react";
import { PageHeader, LoadingBlock, EmptyState, Section } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FeeDialog } from "@/components/admin/FeeDialog";
import {
  ALL_TIME,
  DateRangeFilter,
  resolveRange,
  type RangeState,
} from "@/components/admin/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/data";
import { qk, useFees, useInvalidate, useMembers } from "@/lib/data/hooks";
import { FEE_TYPES, PAYMENT_MODES, type FeePayment, type Member } from "@/lib/data/types";
import {
  formatINR,
  inRange,
  membersWithPendingAnnualFee,
  sumAmounts,
  totalsByType,
} from "@/lib/fees";
import { downloadSheet, escapeCell } from "@/lib/import-export";
import { formatDate } from "@/lib/members";

export const Route = createFileRoute("/admin/_panel/fees")({
  head: () => ({ meta: [{ title: "Fees – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: FeesPage,
});

function FeesPage() {
  const fees = useFees();
  const members = useMembers();
  const [dialog, setDialog] = useState<{ open: boolean; editing: FeePayment | null }>({
    open: false,
    editing: null,
  });

  if (fees.isLoading || members.isLoading) return <LoadingBlock />;
  const list = fees.data ?? [];
  const mlist = members.data ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Member fees"
        description="Record joining and yearly fees, see totals and find members who haven't paid."
        actions={
          <Button variant="navy" onClick={() => setDialog({ open: true, editing: null })}>
            <Plus /> Record payment
          </Button>
        }
      />
      <Tabs defaultValue="payments">
        <TabsList className="mb-5">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="pending">Pending yearly fees</TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <PaymentsTab
            payments={list}
            members={mlist}
            onEdit={(p) => setDialog({ open: true, editing: p })}
          />
        </TabsContent>
        <TabsContent value="pending">
          <PendingTab payments={list} members={mlist} />
        </TabsContent>
      </Tabs>
      <FeeDialog
        open={dialog.open}
        editing={dialog.editing}
        members={mlist}
        onOpenChange={(o) => setDialog({ open: o, editing: o ? dialog.editing : null })}
      />
    </div>
  );
}

function PaymentsTab({
  payments,
  members,
  onEdit,
}: {
  payments: FeePayment[];
  members: Member[];
  onEdit: (p: FeePayment) => void;
}) {
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [mode, setMode] = useState("all");
  const [range, setRange] = useState<RangeState>(ALL_TIME);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    const r = resolveRange(range);
    const term = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (type !== "all" && p.fee_type !== type) return false;
      if (mode !== "all" && p.payment_mode !== mode) return false;
      if (!inRange(p.paid_on, r)) return false;
      if (!term) return true;
      const m = byId.get(p.member_id);
      return (
        p.receipt_number.toLowerCase().includes(term) ||
        (m?.full_name.toLowerCase().includes(term) ?? false) ||
        (m?.member_number.toLowerCase().includes(term) ?? false) ||
        (m?.mobile.includes(term) ?? false)
      );
    });
  }, [payments, q, type, mode, range, byId]);

  const total = sumAmounts(filtered);
  const breakdown = totalsByType(filtered);

  async function exportRows(format: "xlsx" | "csv") {
    const rows: Record<string, string>[] = filtered.map((p) => {
      const m = byId.get(p.member_id);
      return {
        "Receipt No": escapeCell(p.receipt_number),
        "Paid On": formatDate(p.paid_on),
        "Member ID": escapeCell(m?.member_number ?? ""),
        "Member Name": escapeCell(m?.full_name ?? "Deleted member"),
        "Fee Type": p.fee_type,
        For: escapeCell(p.period),
        "Amount (₹)": String(p.amount),
        Mode: p.payment_mode,
        Notes: escapeCell(p.notes),
      };
    });
    rows.push({
      "Receipt No": "",
      "Paid On": "",
      "Member ID": "",
      "Member Name": "TOTAL",
      "Fee Type": "",
      For: "",
      "Amount (₹)": String(total),
      Mode: "",
      Notes: "",
    });
    await downloadSheet(
      rows,
      `htwma-fees-${new Date().toISOString().slice(0, 10)}`,
      format,
      "Fees",
    );
    await db.audit.log(
      "export",
      "fee",
      "-",
      `Exported ${filtered.length} fee payments (${format.toUpperCase()})`,
    );
    toast.success(`Exported ${filtered.length} payments`);
  }

  const filtersOn = q || type !== "all" || mode !== "all" || range.preset !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search member, ID, mobile or receipt…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search payments"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40" aria-label="Fee type filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fee types</SelectItem>
            {FEE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-40" aria-label="Payment mode filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            {PAYMENT_MODES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Paid" />
        {filtersOn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setType("all");
              setMode("all");
              setRange(ALL_TIME);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.2fr_2fr]">
        <div className="rounded-2xl bg-navy-gradient p-5 text-navy-foreground shadow-card">
          <p className="text-sm text-navy-foreground/80">
            Total collected {filtersOn ? "(filtered)" : ""}
          </p>
          <p className="mt-1 font-display text-4xl font-bold" data-testid="fees-total">
            {formatINR(total)}
          </p>
          <p className="mt-1 text-sm text-navy-foreground/80">
            {filtered.length} payment{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4 shadow-card">
          {breakdown.length === 0 && (
            <p className="text-sm text-muted-foreground">No payments in this selection.</p>
          )}
          {breakdown.map((b) => (
            <div key={b.type} className="min-w-32 flex-1 rounded-xl bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {b.type} · {b.count}
              </p>
              <p className="font-display text-xl font-bold text-navy">{formatINR(b.total)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!filtered.length}
          onClick={() => void exportRows("xlsx")}
        >
          <Download /> Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!filtered.length}
          onClick={() => void exportRows("csv")}
        >
          <Download /> CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptIndianRupee className="size-6" />}
          title="No payments found"
          text={filtersOn ? "Try different filters." : "Record the first fee payment."}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const m = byId.get(p.member_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.paid_on)}</TableCell>
                    <TableCell>
                      {m ? (
                        <Link
                          to="/admin/members/$id"
                          params={{ id: m.id }}
                          className="font-medium text-navy hover:underline"
                        >
                          #{m.member_number} · {m.full_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Deleted member</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.fee_type}
                      {p.period && <span className="text-muted-foreground"> · {p.period}</span>}
                      {p.is_demo && (
                        <Badge variant="outline" className="ml-2">
                          Demo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{p.payment_mode}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit payment"
                          onClick={() => onEdit(p)}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              aria-label="Delete payment"
                            >
                              <Trash2 />
                            </Button>
                          }
                          title="Delete this payment?"
                          description={
                            <p>
                              Receipt {p.receipt_number} for {formatINR(p.amount)} will be removed
                              from the totals.
                            </p>
                          }
                          confirmLabel="Delete payment"
                          onConfirm={async () => {
                            await db.fees.remove(p.id);
                            await invalidate(qk.fees, qk.audit);
                            toast.success("Payment deleted");
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PendingTab({ payments, members }: { payments: FeePayment[]; members: Member[] }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map(String);
  const pending = membersWithPendingAnnualFee(members, payments, year).filter((m) => {
    if (status !== "all" && m.status !== status) return false;
    const t = q.trim().toLowerCase();
    return (
      !t ||
      m.full_name.toLowerCase().includes(t) ||
      m.member_number.toLowerCase().includes(t) ||
      m.mobile.includes(t)
    );
  });

  async function exportPending() {
    await downloadSheet(
      pending.map((m) => ({
        "Member ID": escapeCell(m.member_number),
        Name: escapeCell(m.full_name),
        Garage: escapeCell(m.garage_name),
        Mobile: m.mobile,
        Status: m.status,
      })),
      `htwma-pending-yearly-fee-${year}`,
      "xlsx",
      "Pending",
    );
  }

  return (
    <Section
      title={`Yearly fee not recorded for ${year}`}
      description="Active and inactive members with no Annual fee payment for the chosen year."
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={!pending.length}
          onClick={() => void exportPending()}
        >
          <Download /> Export list
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Member status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active members</SelectItem>
            <SelectItem value="inactive">Inactive members</SelectItem>
            <SelectItem value="all">Active & inactive</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, ID or mobile…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search pending members"
          />
        </div>
      </div>
      <p className="mb-3 flex items-center gap-2 text-sm">
        <BellRing className="size-4 text-warning" />{" "}
        <span className="font-semibold">{pending.length}</span> member(s) pending
      </p>
      {pending.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Everyone in this list has paid for {year}.
        </p>
      ) : (
        <ul className="divide-y">
          {pending.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Link
                to="/admin/members/$id"
                params={{ id: m.id }}
                className="min-w-0 flex-1 truncate font-medium text-navy hover:underline"
              >
                #{m.member_number} · {m.full_name}
              </Link>
              <span className="text-muted-foreground">{m.mobile || "No mobile"}</span>
              <IndianRupee className="size-4 text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
