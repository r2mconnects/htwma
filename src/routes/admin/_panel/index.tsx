import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserCheck, Archive, Award, UserPlus, FileSpreadsheet, Printer, ArrowRight, Info } from "lucide-react";
import { PageHeader, StatusBadge, LoadingBlock } from "@/components/admin/common";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { useAssignments, useMembers } from "@/lib/data/hooks";
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
  const list = members.data ?? [];
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
