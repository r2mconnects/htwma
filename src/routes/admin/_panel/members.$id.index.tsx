import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Edit,
  Eye,
  EyeOff,
  FileText,
  IndianRupee,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useFees, useInvalidate, useMember } from "@/lib/data/hooks";
import type { FeePayment, MemberSensitive } from "@/lib/data/types";
import { formatINR } from "@/lib/fees";
import { computeAge, formatDate, initials, maskId } from "@/lib/members";
import { FeeDialog } from "@/components/admin/FeeDialog";
import { PageHeader, Section, StatusBadge } from "@/components/admin/common";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_panel/members/$id/")({
  head: () => ({ meta: [{ title: "Member Details — HTWMA Admin" }] }),
  component: MemberDetailPage,
});

function MemberDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const member = useMember(id);
  const invalidate = useInvalidate();
  const fees = useFees();
  const [revealed, setRevealed] = useState<MemberSensitive | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feeDialog, setFeeDialog] = useState<{ open: boolean; editing: FeePayment | null }>({
    open: false,
    editing: null,
  });
  const [deletingFee, setDeletingFee] = useState<FeePayment | null>(null);

  // Always clear revealed sensitive state when navigating between member profiles
  useEffect(() => {
    setRevealed(null);
  }, [id]);

  if (member.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const m = member.data;
  if (!m) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="font-semibold">Member not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/admin/members">Back to members</Link>
        </Button>
      </div>
    );
  }

  async function toggleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    const s = await db.members.getSensitive(id);
    await db.audit.log(
      "reveal_sensitive",
      "member",
      id,
      `Viewed full ID numbers for #${m!.member_number} ${m!.full_name}`,
    );
    await invalidate(qk.audit);
    setRevealed(s);
  }

  async function openPrivateDocument(path: string | null, label: string) {
    if (!path) return;
    const url = await db.files.getUrl("member-documents", path);
    if (!url) {
      toast.error("Could not generate secure document URL");
      return;
    }
    await db.audit.log(
      "view_document",
      "member",
      id,
      `Opened private ${label} document for #${m!.member_number}`,
    );
    await invalidate(qk.audit);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function toggleArchive() {
    const next = m!.status === "archived" ? "active" : "archived";
    await db.members.setStatus(id, next);
    await invalidate(qk.member(id), qk.members, qk.publicCommittee, qk.audit);
    toast.success(next === "archived" ? "Member archived" : "Member restored");
  }

  async function removePermanently() {
    await db.members.remove(id);
    await invalidate(qk.members, qk.assignments, qk.publicCommittee, qk.fees, qk.audit);
    toast.success("Member permanently deleted");
    navigate({ to: "/admin/members" });
  }

  const year = String(new Date().getFullYear());
  const memberPayments = (fees.data ?? []).filter((p) => p.member_id === id);
  const paidThisYear = memberPayments.some((p) => p.fee_type === "Annual" && p.period === year);
  const totalPaid = memberPayments.reduce((s, p) => s + p.amount, 0);

  async function deleteFee() {
    if (!deletingFee) return;
    await db.fees.remove(deletingFee.id);
    await invalidate(qk.fees, qk.audit);
    toast.success("Payment deleted");
    setDeletingFee(null);
  }

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  );

  const attachedDocs = revealed
    ? [
        { label: "Aadhaar copy", path: revealed.aadhaar_doc_path },
        { label: "PAN copy", path: revealed.pan_doc_path },
        { label: "Driving licence copy", path: revealed.dl_doc_path },
        { label: revealed.other_doc_label || "Other document", path: revealed.other_doc_path },
      ].filter((d) => !!d.path)
    : [];

  return (
    <div className="space-y-6">
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="size-4" /> All members
      </Link>

      <PageHeader
        title={m.full_name}
        subtitle={`Member ID #${m.member_number}${m.registration_number ? ` · Reg ${m.registration_number}` : ""}${m.garage_name ? ` · ${m.garage_name}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/members/$id/print" params={{ id }}>
                <Printer /> Print form
              </Link>
            </Button>
            <Button asChild variant="navy">
              <Link to="/admin/members/$id/edit" params={{ id }}>
                <Edit /> Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border bg-card p-6 text-center shadow-card">
            <StorageImage
              bucket="member-photos"
              path={m.photo_path}
              alt={m.full_name}
              className="mx-auto h-44 w-36 rounded-xl border"
              fallback={
                <div className="mx-auto grid h-44 w-36 place-items-center rounded-xl bg-accent font-display text-3xl font-bold text-navy">
                  {initials(m.full_name)}
                </div>
              }
            />
            <div className="mt-4 flex items-center justify-center gap-2">
              <StatusBadge status={m.status} />
              {m.blood_group && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
                  {m.blood_group}
                </span>
              )}
              {m.is_demo && (
                <span className="rounded bg-gold/30 px-1.5 py-0.5 text-[10px] font-bold">DEMO</span>
              )}
            </div>
            {m.signature_path && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs text-muted-foreground">Signature on file</p>
                <StorageImage
                  bucket="member-signatures"
                  path={m.signature_path}
                  alt="Signature"
                  className="mx-auto h-14 w-44 rounded border bg-card object-contain"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <Section title="Personal & contact">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Member ID"
                value={<span className="font-mono">{m.member_number}</span>}
              />
              <Field label="Registration No." value={m.registration_number || "—"} />
              <Field label="Garage name" value={m.garage_name} />
              <Field label="Date of birth" value={formatDate(m.date_of_birth)} />
              <Field label="Age" value={computeAge(m.date_of_birth) ?? "—"} />
              <Field
                label="Nominee"
                value={
                  [m.nominee_name, m.nominee_age !== null ? `(Age ${m.nominee_age})` : ""]
                    .filter(Boolean)
                    .join(" ") || "—"
                }
              />
              <Field label="Registration date" value={formatDate(m.registration_date)} />
              <Field
                label="Cell (WhatsApp)"
                value={
                  m.mobile ? (
                    <a href={`tel:${m.mobile}`} className="text-brand hover:underline">
                      {m.mobile}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Emergency contact" value={m.emergency_contact} />
              <Field
                label="Address"
                value={<span className="whitespace-pre-line">{m.address}</span>}
              />
              <Field
                label="Residence address"
                value={<span className="whitespace-pre-line">{m.residence_address}</span>}
              />
            </dl>
          </Section>

          <Section
            title="Identity documents"
            description="Masked by default. Revealing full numbers or opening scans is logged."
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Aadhaar"
                value={
                  <span className="font-mono">
                    {revealed ? revealed.aadhaar_number || "—" : maskId(m.aadhaar_last4, "aadhaar")}
                  </span>
                }
              />
              <Field
                label="PAN"
                value={
                  <span className="font-mono">
                    {revealed ? revealed.pan_number || "—" : maskId(m.pan_last4, "pan")}
                  </span>
                }
              />
              <Field
                label="Driving licence"
                value={
                  <span className="font-mono">
                    {revealed ? revealed.driving_licence_number || "—" : maskId(m.dl_last4, "dl")}
                  </span>
                }
              />
            </dl>
            {attachedDocs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                {attachedDocs.map((doc) => (
                  <Button
                    key={doc.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void openPrivateDocument(doc.path, doc.label)}
                  >
                    <FileText className="size-4" /> Open {doc.label}
                  </Button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void toggleReveal()}
            >
              {revealed ? <EyeOff /> : <Eye />}{" "}
              {revealed ? "Hide full numbers & scans" : "Show full numbers & scans"}
            </Button>
          </Section>

          <Section title="Fee payments" description={`Total paid: ${formatINR(totalPaid)}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span
                className={
                  paidThisYear
                    ? "rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success"
                    : "rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning"
                }
              >
                {paidThisYear ? `Paid for ${year}` : `Not yet paid for ${year}`}
              </span>
              <Button
                size="sm"
                variant="navy"
                onClick={() => setFeeDialog({ open: true, editing: null })}
              >
                <Plus /> Record payment
              </Button>
            </div>
            {memberPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded for this member yet.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {memberPayments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="font-semibold text-navy">
                        {formatINR(p.amount)} · {p.fee_type}
                        {p.period ? ` (${p.period})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.paid_on)} · {p.payment_mode} ·{" "}
                        <span className="font-mono">{p.receipt_number}</span>
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild size="sm" variant="ghost" title="Open Fees Ledger">
                        <Link to="/admin/fees">
                          <IndianRupee /> Ledger
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFeeDialog({ open: true, editing: p })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeletingFee(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {(m.notes || m.consent_given) && (
            <Section title="Notes & consent">
              <p className="text-xs text-muted-foreground">
                Consent recorded: {m.consent_given ? "Yes" : "No"}
              </p>
              {m.notes && <p className="mt-2 whitespace-pre-line text-sm">{m.notes}</p>}
            </Section>
          )}

          <Section
            title="Archive or remove"
            description="Archiving hides a member from active lists while keeping past records safe."
          >
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void toggleArchive()}>
                {m.status === "archived" ? <ArchiveRestore /> : <Archive />}
                {m.status === "archived" ? "Restore to active" : "Archive member"}
              </Button>
              {m.status === "archived" && (
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Permanently delete
                </Button>
              )}
            </div>
          </Section>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {m.full_name}?</DialogTitle>
            <DialogDescription>
              This deletes member #{m.member_number}, their private IDs, uploaded documents, photo
              and signature. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void removePermanently()}>
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeeDialog
        open={feeDialog.open}
        onOpenChange={(open) => setFeeDialog({ open, editing: feeDialog.editing })}
        members={[m]}
        presetMemberId={id}
        editing={feeDialog.editing}
      />

      <Dialog open={!!deletingFee} onOpenChange={(o) => !o && setDeletingFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete receipt {deletingFee?.receipt_number}?</DialogTitle>
            <DialogDescription>
              This removes the {formatINR(deletingFee?.amount ?? 0)} payment record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFee(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteFee()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
