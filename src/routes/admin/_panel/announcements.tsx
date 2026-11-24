import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Edit, Eye, EyeOff, Megaphone, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useAnnouncements, useInvalidate } from "@/lib/data/hooks";
import {
  ANNOUNCEMENT_CATEGORIES,
  type Announcement,
  type AnnouncementCategory,
} from "@/lib/data/types";
import { isoDay } from "@/lib/fees";
import { formatDate } from "@/lib/members";
import { PageHeader } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/admin/_panel/announcements")({
  head: () => ({ meta: [{ title: "Announcements — HTWMA Admin" }] }),
  component: AdminAnnouncementsPage,
});

interface EditorState {
  id: string | null;
  title: string;
  body: string;
  category: AnnouncementCategory;
  published_date: string;
  is_published: boolean;
  is_pinned: boolean;
}

export function AdminAnnouncementsPage() {
  const announcements = useAnnouncements();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);

  const items = announcements.data ?? [];

  function openNew() {
    setEditing({
      id: null,
      title: "",
      body: "",
      category: "Notice",
      published_date: isoDay(new Date()),
      is_published: true,
      is_pinned: false,
    });
  }

  function openEdit(a: Announcement) {
    setEditing({
      id: a.id,
      title: a.title,
      body: a.body,
      category: a.category,
      published_date: a.published_date,
      is_published: a.is_published,
      is_pinned: a.is_pinned,
    });
  }

  async function save() {
    if (!editing) return;
    if (editing.title.trim().length < 3) {
      toast.error("Please enter a notice title.");
      return;
    }
    if (editing.body.trim().length < 5) {
      toast.error("Please enter the announcement content.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editing.title.trim(),
        body: editing.body.trim(),
        category: editing.category,
        published_date: editing.published_date || isoDay(new Date()),
        is_published: editing.is_published,
        is_pinned: editing.is_pinned,
      };
      if (editing.id) {
        await db.announcements.update(editing.id, payload);
      } else {
        await db.announcements.create(payload);
      }
      await invalidate(qk.announcements, qk.publishedAnnouncements, qk.audit);
      toast.success(editing.id ? "Announcement updated" : "Announcement published");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save announcement");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: Announcement) {
    await db.announcements.update(a.id, { is_published: !a.is_published });
    await invalidate(qk.announcements, qk.publishedAnnouncements, qk.audit);
    toast.success(a.is_published ? "Hidden from public website" : "Published on website");
  }

  async function togglePin(a: Announcement) {
    await db.announcements.update(a.id, { is_pinned: !a.is_pinned });
    await invalidate(qk.announcements, qk.publishedAnnouncements, qk.audit);
    toast.success(a.is_pinned ? "Unpinned" : "Pinned to top");
  }

  async function confirmRemove() {
    if (!deleting) return;
    await db.announcements.remove(deleting.id);
    await invalidate(qk.announcements, qk.publishedAnnouncements, qk.audit);
    toast.success("Announcement deleted");
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements & Notices"
        subtitle="Publish association meetings, welfare circulars, and updates for mechanics and the public."
        actions={
          <Button variant="navy" onClick={openNew}>
            <Plus /> New Announcement
          </Button>
        }
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Megaphone className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No announcements posted yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Published notices appear automatically on the Home and About pages.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((a) => (
            <article
              key={a.id}
              className="flex flex-col rounded-2xl border bg-card p-5 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent px-2.5 py-0.5 font-semibold text-navy">
                    {a.category}
                  </span>
                  {a.is_pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-bold text-navy">
                      <Pin className="size-3" /> Pinned
                    </span>
                  )}
                  {!a.is_published && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                      Hidden
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">{formatDate(a.published_date)}</span>
              </div>

              <h2 className="mt-3 font-display text-lg font-bold text-navy">{a.title}</h2>
              <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {a.body}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Edit className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void togglePublish(a)}>
                  {a.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {a.is_published ? "Hide" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void togglePin(a)}>
                  {a.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                  {a.is_pinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  onClick={() => setDeleting(a)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>
              Published notices are visible on the public HTWMA website.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  className="mt-1.5"
                  maxLength={180}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) =>
                      setEditing({ ...editing, category: v as AnnouncementCategory })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANNOUNCEMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ann-date">Notice date</Label>
                  <Input
                    id="ann-date"
                    type="date"
                    className="mt-1.5"
                    value={editing.published_date}
                    onChange={(e) => setEditing({ ...editing, published_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ann-body">Notice details *</Label>
                <Textarea
                  id="ann-body"
                  className="mt-1.5"
                  rows={5}
                  maxLength={4000}
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.is_published}
                    onCheckedChange={(c) => setEditing({ ...editing, is_published: c === true })}
                  />
                  Show on public website
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.is_pinned}
                    onCheckedChange={(c) => setEditing({ ...editing, is_pinned: c === true })}
                  />
                  Pin to top
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="navy" disabled={saving} onClick={() => void save()}>
              Save announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleting?.title}"?</DialogTitle>
            <DialogDescription>
              This removes the announcement permanently from the website.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmRemove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
