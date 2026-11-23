import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, UserCheck, Archive, Award, UserPlus, FileSpreadsheet, Printer, ArrowRight, Info, IndianRupee, BellRing, ReceiptIndianRupee } from "lucide-react";
import { ALL_TIME, DateRangeFilter, resolveRange, type RangeState } from "@/components/admin/DateRangeFilter";
import { formatINR, inRange, membersWithPendingAnnualFee, sumAmounts, totalsByType } from "@/lib/fees";
import { PageHeader, StatusBadge, LoadingBlock } from "@/components/admin/common";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { useAssignments, useFees, useMembers } from "@/lib/data/hooks";
import { db } from "@/lib/data";
import { formatDate } from "@/lib/members";

export const Route = createFileRoute("/admin/_panel/")({
  head: () => ({ meta: [{ title: "Dashboard – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { session } = Route.useRouteContext();
  const members = useMembers();
  const assignments = useAssignments();
  const fees = useFees();
  const [range, setRange] = useState<RangeState>(ALL_TIME);
  const list = members.data ?? [];
  const payments = fees.data ?? [];
  const year = String(new Date().getFullYear());
  const periodPayments = useMemo(() => {
    const r = resolveRange(range);
    return payments.filter((p) => inRange(p.paid_on, r));
  }, [payments, range]);
  const periodTotal = sumAmounts(periodPayments);
  const allTotal = sumAmounts(payments);
  const breakdown = totalsByType(periodPayments);
  const pending = membersWithPendingAnnualFee(list.filter((m) => m.status === "active"), payments, year).length;
  const recentPayments = periodPayments.slice(0, 5);
  const byId = new Map(list.map((m) => [m.id, m]));
  const active = list.filter((m) => m.status === "active").length;
  const archived = list.filter((m) => m.status !== "active").length;
  const committee = (assignments.data ?? []).filter((a) => a.is_active).length;
  const recent = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const demo = list.filter((m) => m.is_demo).length;

  const cards = [
    { label: "Total members", value: list.length, icon: Users, tone: "bg-primary text-primary-foreground" },
    { label: "Active members", value: active, icon: UserCheck, tone: "bg-success text-primary-foreground" },
    { label: "Inactive / archived", value: archived, icon: Archive, tone: "bg-warning text-navy" },
    { label: "Committee members", value: committee, icon: Award, tone: "bg-navy text-navy-foreground" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${session.display_name}`}
        description="Overview of the association's member records."
        actions={
          <Button asChild variant="navy">
            <Link to="/admin/members/new"><UserPlus /> Add member</Link>
          </Button>
        }
      />

      {db.kind === "local" && demo > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-secondary p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            {demo} demo records are included so you can try the system. Remove them any time from{" "}
            <Link to="/admin/settings" className="font-semibold text-primary underline">Settings</Link>.
          </p>
        </div>
      )}

      {members.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className={`grid size-11 place-items-center rounded-xl ${c.tone}`}>
                <c.icon className="size-5" />
              </div>
              <p className="mt-4 font-display text-3xl font-bold text-navy">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy"><IndianRupee className="size-5 text-primary" /> Fees collected</h2>
          <DateRangeFilter value={range} onChange={setRange} label="Period" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-navy-gradient p-5 text-navy-foreground">
            <p className="text-sm text-navy-foreground/80">Total amount {range.preset === "all" ? "(all time)" : "(selected period)"}</p>
            <p className="mt-1 font-display text-4xl font-bold" data-testid="dashboard-fee-total">{formatINR(periodTotal)}</p>
            <p className="mt-1 text-sm text-navy-foreground/80">{periodPayments.length} payment(s){range.preset !== "all" && ` · all time ${formatINR(allTotal)}`}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">By fee type</p>
            {breakdown.length === 0 ? <p className="text-sm text-muted-foreground">No payments in this period.</p> : (
              <ul className="space-y-1.5 text-sm">
                {breakdown.map((b) => (
                  <li key={b.type} className="flex justify-between"><span>{b.type} <span className="text-muted-foreground">({b.count})</span></span><strong>{formatINR(b.total)}</strong></li>
                ))}
              </ul>
            )}
          </div>
          <Link to="/admin/fees" className="flex flex-col justify-between rounded-2xl border border-warning/40 bg-warning/5 p-4 transition hover:border-warning">
            <p className="flex items-center gap-2 text-sm font-medium"><BellRing className="size-4 text-warning" /> Yearly fee {year} pending</p>
            <p className="font-display text-3xl font-bold text-navy">{pending}</p>
            <p className="text-xs text-muted-foreground">active members · open Fees to see the list</p>
          </Link>
        </div>
        {recentPayments.length > 0 && (
          <ul className="mt-4 divide-y border-t text-sm">
            {recentPayments.map((p) => {
              const m = byId.get(p.member_id);
              return (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <ReceiptIndianRupee className="size-4 text-muted-foreground" />
                  <span className="w-24 text-muted-foreground">{formatDate(p.paid_on)}</span>
                  <span className="min-w-0 flex-1 truncate">{m ? `#${m.member_number} · ${m.full_name}` : "Deleted member"} — {p.fee_type}</span>
                  <strong>{formatINR(p.amount)}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Recently added</h2>
            <Button asChild variant="link" size="sm" className="px-0">
              <Link to="/admin/members">All members <ArrowRight /></Link>
            </Button>
          </div>
          <ul className="divide-y">
            {recent.map((m) => (
              <li key={m.id}>
                <Link to="/admin/members/$id" params={{ id: m.id }} className="flex items-center gap-3 py-3 hover:bg-muted/50">
                  <StorageImage bucket="member-photos" path={m.photo_path} alt={m.full_name} fallbackName={m.full_name} className="size-10 shrink-0 rounded-full text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy">{m.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">#{m.member_number} · {m.garage_name || "No garage"} · added {formatDate(m.created_at.slice(0, 10))}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
            {recent.length === 0 && !members.isLoading && <li className="py-6 text-center text-sm text-muted-foreground">No members yet.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Quick actions</h2>
          <div className="grid gap-2">
            {[
              { to: "/admin/members/new", label: "Add a new member", icon: UserPlus },
              { to: "/admin/fees", label: "Record a fee payment", icon: IndianRupee },
              { to: "/admin/import-export", label: "Import from Excel / CSV", icon: FileSpreadsheet },
              { to: "/admin/registration-form", label: "Print blank registration form", icon: Printer },
              { to: "/admin/committee", label: "Manage committee", icon: Award },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium text-navy transition hover:border-primary hover:bg-secondary">
                <a.icon className="size-5 text-primary" /> {a.label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
