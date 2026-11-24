import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Archive,
  CheckCircle2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useContactMessages, useInvalidate } from "@/lib/data/hooks";
import type { ContactMessage, ContactMessageStatus } from "@/lib/data/types";
import { PageHeader } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_panel/messages")({
  head: () => ({ meta: [{ title: "Contact Messages — HTWMA Admin" }] }),
  component: AdminMessagesPage,
});

const STATUS_STYLE: Record<ContactMessageStatus, string> = {
  unread: "bg-gold/25 text-navy font-bold",
  read: "bg-accent text-navy font-semibold",
  replied: "bg-success/15 text-success font-semibold",
  archived: "bg-muted text-muted-foreground font-medium",
};

export function AdminMessagesPage() {
  const messages = useContactMessages();
  const invalidate = useInvalidate();
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);

  const list = (messages.data ?? []).filter((m) => filter === "all" || m.status === filter);

  async function setStatus(m: ContactMessage, status: ContactMessageStatus) {
    await db.messages.update(m.id, { status });
    await invalidate(qk.messages, qk.audit);
    toast.success(`Marked as ${status}`);
  }

  function openNotes(m: ContactMessage) {
    setSelected(m);
    setNotesDraft(m.admin_notes);
    if (m.status === "unread") {
      void db.messages.update(m.id, { status: "read" }).then(() => invalidate(qk.messages));
    }
  }

  async function saveNotes() {
    if (!selected) return;
    await db.messages.update(selected.id, { admin_notes: notesDraft });
    await invalidate(qk.messages, qk.audit);
    toast.success("Internal note saved");
    setSelected(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await db.messages.remove(deleting.id);
    await invalidate(qk.messages, qk.audit);
    toast.success("Message deleted");
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Enquiries"
        subtitle="Messages submitted by visitors and prospective members on the public Contact page."
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All messages</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {list.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <MessageSquare className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No contact messages in this view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((m) => {
            const waDigits = m.sender_phone.replace(/\D/g, "");
            return (
              <article key={m.id} className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-navy">{m.sender_name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLE[m.status]}`}
                      >
                        {m.status}
                      </span>
                    </div>
                    {m.subject && (
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{m.subject}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground">
                  {m.message}
                </p>

                {m.admin_notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-navy">Office note:</span> {m.admin_notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    {m.sender_phone && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${m.sender_phone}`}>
                          <Phone className="size-3.5" /> {m.sender_phone}
                        </a>
                      </Button>
                    )}
                    {waDigits && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="size-3.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    {m.sender_email && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`mailto:${m.sender_email}`}>
                          <Mail className="size-3.5" /> {m.sender_email}
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openNotes(m)}>
                      Note / View
                    </Button>
                    {m.status !== "replied" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void setStatus(m, "replied")}
                      >
                        <CheckCircle2 className="size-4 text-success" /> Mark replied
                      </Button>
                    )}
                    {m.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void setStatus(m, "archived")}
                      >
                        <Archive className="size-4" /> Archive
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleting(m)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enquiry from {selected?.sender_name}</DialogTitle>
            <DialogDescription>
              Record an internal follow-up note for office-bearers.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="whitespace-pre-line rounded-xl bg-muted p-3 text-sm">
                {selected.message}
              </p>
              <Textarea
                rows={3}
                maxLength={1000}
                placeholder="Internal note (not shown publicly)…"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button variant="navy" onClick={() => void saveNotes()}>
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete message from {deleting?.sender_name}?</DialogTitle>
            <DialogDescription>This removes the enquiry permanently.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
