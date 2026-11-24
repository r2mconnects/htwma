import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  Printer,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingBlock } from "@/components/admin/common";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ALL_TIME,
  DateRangeFilter,
  resolveRange,
  type RangeState,
} from "@/components/admin/DateRangeFilter";
import { inRange } from "@/lib/fees";
import type { Member, MemberStatus } from "@/lib/data/types";
import { BLOOD_GROUPS, compareMemberNumbers, maskId, normalizePhone } from "@/lib/members";
import { downloadSheet, memberToExportRow, SAFE_EXPORT_DEFAULT } from "@/lib/import-export";

export const Route = createFileRoute("/admin/_panel/members/")({
  head: () => ({
    meta: [{ title: "Members – HTWMA Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: MembersPage,
});

const PAGE_SIZE = 20;
type Sort = "number" | "name" | "recent" | "garage";

function MembersPage() {
  const { data, isLoading } = useMembers();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MemberStatus | "all" | "current">("current");
  const [blood, setBlood] = useState("all");
  const [sort, setSort] = useState<Sort>("number");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feeStatus, setFeeStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [regRange, setRegRange] = useState<RangeState>(ALL_TIME);
  const fees = useFees();
  const year = String(new Date().getFullYear());
  const paidIds = useMemo(
    () =>
      new Set(
        (fees.data ?? [])
          .filter((p) => p.fee_type === "Annual" && p.period === year)
          .map((p) => p.member_id),
      ),
    [fees.data, year],
  );
  const filtersOn =
    !!q ||
    status !== "current" ||
    blood !== "all" ||
    feeStatus !== "all" ||
    regRange.preset !== "all";
  function clearFilters() {
    setQ("");
    setStatus("current");
    setBlood("all");
    setFeeStatus("all");
    setRegRange(ALL_TIME);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = normalizePhone(term);
    const reg = resolveRange(regRange);
    let list = (data ?? []).filter((m) => {
      if (status === "current" && m.status === "archived") return false;
      if (status !== "all" && status !== "current" && m.status !== status) return false;
      if (blood !== "all" && m.blood_group !== blood) return false;
      if (feeStatus === "paid" && !paidIds.has(m.id)) return false;
      if (feeStatus === "unpaid" && paidIds.has(m.id)) return false;
      if (!inRange(m.registration_date, reg)) return false;
      if (!term) return true;
      return (
        m.full_name.toLowerCase().includes(term) ||
        m.member_number.toLowerCase().includes(term) ||
        m.garage_name.toLowerCase().includes(term) ||
        (digits.length >= 3 && (m.mobile.includes(digits) || m.emergency_contact.includes(digits)))
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      if (sort === "garage") return a.garage_name.localeCompare(b.garage_name);
      if (sort === "recent") return b.created_at.localeCompare(a.created_at);
      return compareMemberNumbers(a.member_number, b.member_number);
    });
    return list;
  }, [data, q, status, blood, sort, feeStatus, paidIds, regRange]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function toggleArchive(m: Member) {
    const next = m.status === "archived" ? "active" : "archived";
    try {
      await db.members.setStatus(m.id, next);
      await invalidate(qk.members);
      toast.success(next === "archived" ? `Archived ${m.full_name}` : `Restored ${m.full_name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function exportSelected() {
    const chosen = (data ?? []).filter((m) => selected.has(m.id));
    await downloadSheet(
      chosen.map((m) => memberToExportRow(m, SAFE_EXPORT_DEFAULT, undefined)),
      "htwma-selected-members",
      "xlsx",
    );
    await db.audit.log(
      "export",
      "member",
      "-",
      `Exported ${chosen.length} selected member(s) (safe columns)`,
    );
    toast.success(`Exported ${chosen.length} member(s)`);
  }

  const printIds = selected.size ? [...selected].join(",") : "";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Members"
        description={`${data?.length ?? 0} records · search by name, member ID, garage or mobile`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/members/print" search={{ ids: printIds }}>
                <Printer /> Print {selected.size ? "selected" : "directory"}
              </Link>
            </Button>
            <Button asChild variant="navy">
              <Link to="/admin/members/new">
                <UserPlus /> Add member
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, ID, garage, mobile…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            aria-label="Search members"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="md:w-44" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Active & inactive</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={blood}
          onValueChange={(v) => {
            setBlood(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="md:w-36" aria-label="Blood group filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any blood group</SelectItem>
            {BLOOD_GROUPS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={feeStatus}
          onValueChange={(v) => {
            setFeeStatus(v as typeof feeStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="md:w-48" aria-label="Fee status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any fee status</SelectItem>
            <SelectItem value="paid">Yearly fee {year} paid</SelectItem>
            <SelectItem value="unpaid">Yearly fee {year} pending</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          value={regRange}
          onChange={(v) => {
            setRegRange(v);
            setPage(1);
          }}
          label="Registered"
        />
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="md:w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Sort: Member ID</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="garage">Sort: Garage</SelectItem>
            <SelectItem value="recent">Sort: Recently added</SelectItem>
          </SelectContent>
        </Select>
        {filtersOn && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => void exportSelected()}>
            <Download /> Export selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No members found"
          text={
            filtersOn
              ? "Try a different search or filter."
              : "Add your first member or import from Excel."
          }
          action={
            <Button asChild variant="navy">
              <Link to="/admin/members/new">
                <UserPlus /> Add member
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPage}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        rows.forEach((r) => (c ? next.add(r.id) : next.delete(r.id)));
                        setSelected(next);
                      }}
                      aria-label="Select page"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Blood</TableHead>
                  <TableHead>Aadhaar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/admin/members/$id", params: { id: m.id } })}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={() => toggle(m.id)}
                        aria-label={`Select ${m.full_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-navy">
                      {m.member_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <StorageImage
                          bucket="member-photos"
                          path={m.photo_path}
                          alt={m.full_name}
                          fallbackName={m.full_name}
                          className="size-9 shrink-0 rounded-full text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.garage_name || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{m.mobile || "—"}</TableCell>
                    <TableCell>{m.blood_group || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {maskId(m.aadhaar_last4, "aadhaar")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild aria-label="View">
                          <Link to="/admin/members/$id" params={{ id: m.id }}>
                            <Eye />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" asChild aria-label="Edit">
                          <Link to="/admin/members/$id/edit" params={{ id: m.id }}>
                            <Pencil />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={m.status === "archived" ? "Restore" : "Archive"}
                          onClick={() => void toggleArchive(m)}
                        >
                          {m.status === "archived" ? <ArchiveRestore /> : <Archive />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((m) => (
              <div key={m.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.has(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                    aria-label={`Select ${m.full_name}`}
                  />
                  <StorageImage
                    bucket="member-photos"
                    path={m.photo_path}
                    alt={m.full_name}
                    fallbackName={m.full_name}
                    className="size-12 shrink-0 rounded-full"
                  />
                  <Link to="/admin/members/$id" params={{ id: m.id }} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{m.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      #{m.member_number} · {m.garage_name || "No garage"}
                    </p>
                    <p className="mt-1 text-sm">
                      {m.mobile || "No mobile"} {m.blood_group && `· ${m.blood_group}`}
                    </p>
                  </Link>
                  <StatusBadge status={m.status} />
                </div>
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link to="/admin/members/$id/edit" params={{ id: m.id }}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => void toggleArchive(m)}
                  >
                    {m.status === "archived" ? (
                      <>
                        <ArchiveRestore /> Restore
                      </>
                    ) : (
                      <>
                        <Archive /> Archive
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(current - 1) * PAGE_SIZE + 1}–
              {Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span>
                Page {current} / {pages}
              </span>
              <Button
                size="icon"
                variant="outline"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
