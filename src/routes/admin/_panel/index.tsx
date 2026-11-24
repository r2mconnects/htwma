import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  FileSpreadsheet,
  Images,
  IndianRupee,
  Megaphone,
  MessageSquare,
  Printer,
  Trash2,
  UserPlus,
  Users,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import {
  qk,
  useAnnouncements,
  useAssignments,
  useContactMessages,
  useFees,
  useGallery,
  useInvalidate,
  useMembers,
} from "@/lib/data/hooks";
import { formatINR } from "@/lib/fees";
import { PageHeader, Section } from "@/components/admin/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/_panel/")({
  head: () => ({ meta: [{ title: "Dashboard — HTWMA Admin" }] }),
  component: Dashboard,
});

function Dashboard() {
  const members = useMembers();
  const assignments = useAssignments();
  const gallery = useGallery();
  const announcements = useAnnouncements();
  const messages = useContactMessages();
  const fees = useFees();
  const audit = useQuery({ queryKey: qk.audit, queryFn: () => db.audit.list(12) });
  const invalidate = useInvalidate();

  const list = members.data ?? [];
  const active = list.filter((m) => m.status === "active").length;
  const inactive = list.filter((m) => m.status === "inactive").length;
  const archived = list.filter((m) => m.status === "archived").length;
  const hasDemo =
    list.some((m) => m.is_demo) ||
    (gallery.data ?? []).some((g) => g.is_demo) ||
    (fees.data ?? []).some((f) => f.is_demo);

  const year = String(new Date().getFullYear());
  const payments = fees.data ?? [];
  const yearTotal = payments
    .filter((p) => p.paid_on.startsWith(year))
    .reduce((s, p) => s + p.amount, 0);
  const paidIds = new Set(
    payments.filter((p) => p.fee_type === "Annual" && p.period === year).map((p) => p.member_id),
  );
  const unpaidCount = list.filter((m) => m.status === "active" && !paidIds.has(m.id)).length;
  const unreadMessages = (messages.data ?? []).filter((m) => m.status === "unread").length;

  async function clearDemo() {
    if (!confirm("Remove all sample/demo records? Real members you added will not be touched."))
      return;
    const removed = await db.maintenance.clearDemoData();
    await invalidate(
      qk.members,
      qk.assignments,
      qk.publicCommittee,
      qk.gallery,
      qk.publishedGallery,
      qk.fees,
      qk.audit,
    );
    toast.success(`Removed ${removed} sample item(s)`);
  }

  const stats = [
    {
      label: "Active members",
      value: active,
      sub: `${inactive} inactive · ${archived} archived`,
      icon: Users,
      to: "/admin/members" as const,
    },
    {
      label: `Collected in ${year}`,
      value: formatINR(yearTotal),
      sub: "All fee types",
      icon: IndianRupee,
      to: "/admin/fees" as const,
    },
    {
      label: `Unpaid for ${year}`,
      value: unpaidCount,
      sub: `of ${active} active members`,
      icon: AlertCircle,
      to: "/admin/fees" as const,
    },
    {
      label: "Unread enquiries",
      value: unreadMessages,
      sub: `${(messages.data ?? []).length} total messages`,
      icon: MessageSquare,
      to: "/admin/messages" as const,
    },
    {
      label: "Committee",
      value: (assignments.data ?? []).filter((a) => a.is_active).length,
      sub: "Active office-bearers",
      icon: Award,
      to: "/admin/committee" as const,
    },
    {
      label: "Gallery & Notices",
      value: `${(gallery.data ?? []).filter((g) => g.is_published).length} / ${(announcements.data ?? []).filter((a) => a.is_published).length}`,
      sub: "Photos · Notices live",
      icon: Images,
      to: "/admin/gallery" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Manage HTWMA membership, office-bearers, announcements, enquiries and public website records."
        actions={
          <Button asChild variant="navy">
            <Link to="/admin/members/new">
              <UserPlus /> Add New Member
            </Link>
          </Button>
        }
      />

      {hasDemo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-gold/15 p-4 text-sm">
          <p className="font-medium text-navy">
            Sample records marked{" "}
            <span className="rounded bg-gold/40 px-1.5 py-0.5 text-xs font-bold">DEMO</span> are
            present. Clear them anytime once real association data is entered.
          </p>
          <Button variant="outline" size="sm" onClick={() => void clearDemo()}>
            <Trash2 /> Remove sample data
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="size-5 text-brand" />
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-navy">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Section title="Quick actions">
            <div className="grid gap-2.5">
              <Button asChild variant="outline" className="justify-start h-11">
                <Link to="/admin/members/new">
                  <UserPlus /> Register a new member
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-11">
                <Link to="/admin/announcements">
                  <Megaphone /> Post an association notice
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-11">
                <Link to="/admin/messages">
                  <MessageSquare /> View public contact messages
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-11">
                <Link to="/admin/import-export">
                  <FileSpreadsheet /> Import / Export Excel or CSV
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-11">
                <Link to="/admin/registration-form">
                  <Printer /> Print blank registration form
                </Link>
              </Button>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-7">
          <Section title="Recent admin activity">
            {(audit.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(audit.data ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{a.summary}</p>
                      {a.admin_email && (
                        <p className="truncate text-xs text-muted-foreground">by {a.admin_email}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
