import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Printer, Archive, ArchiveRestore, Trash2, Eye, EyeOff, ArrowLeft, UserX, ShieldCheck, IndianRupee, Plus } from "lucide-react";
import { PageHeader, StatusBadge, LoadingBlock, EmptyState } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/data";
import { qk, useFees, useInvalidate, useMember, useMembers } from "@/lib/data/hooks";
import type { FeePayment, MemberSensitive } from "@/lib/data/types";
import { computeAge, formatDate, maskId } from "@/lib/members";
import { FeeDialog } from "@/components/admin/FeeDialog";
import { formatINR, hasPaidAnnual, sumAmounts } from "@/lib/fees";

export const Route = createFileRoute("/admin/_panel/members/$id/")({
  head: () => ({ meta: [{ title: "Member Profile – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: MemberProfile,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b py-2.5 text-sm last:border-0 sm:grid-cols-[11rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value || "—"}</dd>
    </div>
  );
}

function MemberProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: m, isLoading } = useMember(id);
  const [ids, setIds] = useState<MemberSensitive | null>(null);
  const fees = useFees();
  const allMembers = useMembers();
  const [feeDialog, setFeeDialog] = useState<{ open: boolean; editing: FeePayment | null }>({ open: false, editing: null });

  if (isLoading) return <LoadingBlock />;
  if (!m) return <EmptyState icon={<UserX className="size-6" />} title="Member not found" text="This record may have been deleted." action={<Button asChild variant="outline"><Link to="/admin/members">Back to members</Link></Button>} />;

  async function reveal() {
    if (ids) { setIds(null); return; }
    const s = await db.members.getSensitive(id);
    await db.audit.log("view_sensitive", "member", id, `Viewed ID numbers of #${m!.member_number}`);
    setIds(s);
  }

  async function setStatus(status: "active" | "archived") {
    await db.members.setStatus(id, status);
    await invalidate(qk.members);
    toast.success(status === "archived" ? "Member archived" : "Member restored");
  }

  async function remove() {
    await db.members.remove(id);
    await invalidate(qk.members, qk.assignments, qk.publicCommittee, qk.fees);
    toast.success("Member permanently deleted");
    navigate({ to: "/admin/members" });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/admin/members" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> All members
      </Link>
      <PageHeader
        title={m.full_name}
        description={`Member ID #${m.member_number}${m.is_demo ? " · Demo record" : ""}`}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/admin/members/$id/print" params={{ id }}><Printer /> Print form</Link></Button>
            <Button variant="navy" asChild><Link to="/admin/members/$id/edit" params={{ id }}><Pencil /> Edit</Link></Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
            <StorageImage bucket="member-photos" path={m.photo_path} alt={m.full_name} fallbackName={m.full_name} className="mx-auto h-48 w-40 rounded-xl text-4xl" />
            <p className="mt-4 font-display text-lg font-bold text-navy">{m.full_name}</p>
            <p className="text-sm text-muted-foreground">{m.garage_name || "No garage name"}</p>
            <div className="mt-3"><StatusBadge status={m.status} /></div>
          </div>
          <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-card">
            {m.status === "archived" ? (
              <Button variant="outline" className="w-full" onClick={() => void setStatus("active")}><ArchiveRestore /> Restore member</Button>
            ) : (
              <ConfirmDialog
                trigger={<Button variant="outline" className="w-full"><Archive /> Archive member</Button>}
                title="Archive this member?"
                description={<p>{m.full_name} will be hidden from the active directory. You can restore them any time.</p>}
                confirmLabel="Archive"
                destructive={false}
                onConfirm={() => setStatus("archived")}
              />
            )}
            {m.status === "archived" ? (
              <ConfirmDialog
                trigger={<Button variant="ghost" className="w-full text-destructive"><Trash2 /> Delete permanently</Button>}
                title="Permanently delete this member?"
                description={<p>This removes the record, photo, signature, ID numbers, fee payments and committee roles. It cannot be undone.</p>}
                confirmLabel="Delete forever"
                requireText={m.member_number}
                onConfirm={remove}
              />
            ) : (
              <p className="px-1 text-xs text-muted-foreground">To delete permanently, archive the member first.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-2 font-display text-lg font-bold text-navy">Personal & contact</h2>
            <dl>
              <Row label="Date of birth" value={formatDate(m.date_of_birth)} />
              <Row label="Age" value={String(computeAge(m.date_of_birth) ?? "")} />
              <Row label="Blood group" value={m.blood_group} />
              <Row label="Nominee" value={m.nominee_name} />
              <Row label="Cell (WhatsApp)" value={m.mobile} />
              <Row label="Emergency contact" value={m.emergency_contact} />
              <Row label="Address" value={m.address} />
              <Row label="Residence address" value={m.residence_address} />
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy"><ShieldCheck className="size-5 text-teal" /> Identity documents</h2>
              <Button size="sm" variant="outline" onClick={() => void reveal()}>
                {ids ? <><EyeOff /> Hide</> : <><Eye /> Show full numbers</>}
              </Button>
            </div>
            <dl>
              <Row label="Aadhaar" value={ids ? ids.aadhaar_number : maskId(m.aadhaar_last4, "aadhaar")} />
              <Row label="PAN" value={ids ? ids.pan_number : maskId(m.pan_last4, "pan")} />
              <Row label="Driving licence" value={ids ? ids.driving_licence_number : maskId(m.dl_last4, "dl")} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Viewing full numbers is recorded in the activity log.</p>
          </section>

          <FeesSection
            payments={(fees.data ?? []).filter((p) => p.member_id === id)}
            onAdd={() => setFeeDialog({ open: true, editing: null })}
            onEdit={(p) => setFeeDialog({ open: true, editing: p })}
          />

          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-2 font-display text-lg font-bold text-navy">Registration</h2>
            <dl>
              <Row label="Registration date" value={formatDate(m.registration_date)} />
              <Row label="Consent recorded" value={m.consent_given ? "Yes" : "No"} />
              <Row label="Notes" value={m.notes} />
              <Row label="Last updated" value={new Date(m.updated_at).toLocaleString("en-IN")} />
            </dl>
            {m.signature_path && (
              <div className="mt-3">
                <p className="mb-1 text-sm text-muted-foreground">Signature</p>
                <StorageImage bucket="member-signatures" path={m.signature_path} alt="Signature" className="h-16 w-48 rounded border object-contain" />
              </div>
            )}
          </section>
        </div>
      </div>
      <FeeDialog
        open={feeDialog.open}
        editing={feeDialog.editing}
        presetMemberId={id}
        members={allMembers.data ?? [m]}
        onOpenChange={(o) => setFeeDialog({ open: o, editing: o ? feeDialog.editing : null })}
      />
    </div>
  );
}

function FeesSection({ payments, onAdd, onEdit }: { payments: FeePayment[]; onAdd: () => void; onEdit: (p: FeePayment) => void }) {
  const year = String(new Date().getFullYear());
  const paid = hasPaidAnnual(payments[0]?.member_id ?? "", payments, year);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy"><IndianRupee className="size-5 text-primary" /> Fees</h2>
        <Button size="sm" variant="navy" onClick={onAdd}><Plus /> Record payment</Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-secondary px-3 py-1.5">Total paid: <strong>{formatINR(sumAmounts(payments))}</strong></span>
        <span className={`rounded-lg px-3 py-1.5 ${paid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          Yearly fee {year}: <strong>{paid ? "Paid" : "Not recorded"}</strong>
        </span>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-24 text-muted-foreground">{formatDate(p.paid_on)}</span>
              <span className="flex-1">{p.fee_type}{p.period ? ` · ${p.period}` : ""} <span className="text-xs text-muted-foreground">({p.payment_mode}, {p.receipt_number})</span></span>
              <span className="font-semibold">{formatINR(p.amount)}</span>
              <Button size="icon" variant="ghost" aria-label="Edit payment" onClick={() => onEdit(p)}><Pencil /></Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
