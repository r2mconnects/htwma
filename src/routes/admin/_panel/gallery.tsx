import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useGallery, useInvalidate } from "@/lib/data/hooks";
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from "@/lib/data/types";
import { isoDay } from "@/lib/fees";
import { PageHeader } from "@/components/admin/common";
import {
  ImageInput,
  emptyImage,
  finalizeStagedUploads,
  rollbackStagedUploads,
  stageImageUpload,
  type ImageValue,
  type StagedUpload,
} from "@/components/admin/ImageInput";
import { StorageImage } from "@/components/StorageImage";
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

export const Route = createFileRoute("/admin/_panel/gallery")({
  head: () => ({ meta: [{ title: "Gallery — HTWMA Admin" }] }),
  component: AdminGalleryPage,
});

interface EditorState {
  id: string | null;
  title: string;
  caption: string;
  alt_text: string;
  credit: string;
  category: GalleryCategory;
  event_date: string;
  is_published: boolean;
  image: ImageValue;
}

function AdminGalleryPage() {
  const gallery = useGallery();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const items = gallery.data ?? [];

  function openNew() {
    setEditing({
      id: null,
      title: "",
      caption: "",
      alt_text: "",
      credit: "",
      category: "Events",
      event_date: isoDay(new Date()),
      is_published: true,
      image: emptyImage(),
    });
  }

  function openEdit(g: GalleryItem) {
    setEditing({
      id: g.id,
      title: g.title,
      caption: g.caption,
      alt_text: g.alt_text,
      credit: g.credit,
      category: g.category,
      event_date: g.event_date ?? "",
      is_published: g.is_published,
      image: emptyImage(g.image_path),
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!editing.image.file && (!editing.image.path || editing.image.removed)) {
      toast.error("Please choose an image");
      return;
    }
    setSaving(true);
    const staged: StagedUpload[] = [];
    try {
      const stagedImg = await stageImageUpload(
        editing.image,
        "public-media",
        db.files.upload,
        "gallery.jpg",
      );
      staged.push(stagedImg);
      const path = stagedImg.nextPath!;
      const cleanTitle = editing.title.trim();
      const payload = {
        title: cleanTitle,
        caption: editing.caption.trim(),
        alt_text: editing.alt_text.trim() || cleanTitle,
        credit: editing.credit.trim(),
        category: editing.category,
        event_date: editing.event_date || null,
        is_published: editing.is_published,
        image_path: path,
      };
      if (editing.id) {
        await db.gallery.update(editing.id, payload);
      } else {
        await db.gallery.create({
          ...payload,
          display_order: items.length + 1,
        });
      }
      await finalizeStagedUploads(staged, db.files.remove);
      await invalidate(qk.gallery, qk.publishedGallery, qk.audit);
      toast.success(editing.id ? "Photo updated" : "Photo uploaded");
      setEditing(null);
    } catch (e) {
      await rollbackStagedUploads(staged, db.files.remove);
      toast.error(e instanceof Error ? e.message : "Could not save photo");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(g: GalleryItem) {
    await db.gallery.update(g.id, { is_published: !g.is_published });
    await invalidate(qk.gallery, qk.publishedGallery, qk.audit);
    toast.success(g.is_published ? "Hidden from website" : "Published");
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (!next[target]) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    await db.gallery.reorder(next.map((x) => x.id));
    await invalidate(qk.gallery, qk.publishedGallery);
  }

  async function remove(g: GalleryItem) {
    if (!confirm(`Delete "${g.title}" permanently?`)) return;
    await db.gallery.remove(g.id);
    await invalidate(qk.gallery, qk.publishedGallery, qk.audit);
    toast.success("Photo deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery"
        subtitle="Upload association event, meeting and workshop photos."
        actions={
          <Button variant="navy" onClick={openNew}>
            <Plus /> Upload Photo
          </Button>
        }
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="font-medium">No photos yet.</p>
          <Button variant="navy" className="mt-4" onClick={openNew}>
            <Plus /> Upload first photo
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g, idx) => (
            <div key={g.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="relative">
                <StorageImage
                  bucket="public-media"
                  path={g.image_path}
                  alt={g.alt_text || g.title}
                  className="aspect-[16/10] w-full"
                />
                {!g.is_published && (
                  <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-semibold text-background">
                    Hidden
                  </span>
                )}
              </div>
              <div className="p-4">
                <span className="text-xs font-semibold text-brand">{g.category}</span>
                <h2 className="mt-0.5 font-display text-base font-bold text-navy">{g.title}</h2>
                {g.caption && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.caption}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === 0}
                    onClick={() => void move(idx, -1)}
                    aria-label="Move earlier"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === items.length - 1}
                    onClick={() => void move(idx, 1)}
                    aria-label="Move later"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void togglePublish(g)}
                    aria-label={g.is_published ? "Hide" : "Publish"}
                  >
                    {g.is_published ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(g)} aria-label="Edit">
                    <Edit />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-destructive"
                    onClick={() => void remove(g)}
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit photo" : "Upload photo"}</DialogTitle>
            <DialogDescription>
              Gallery photos are stored in public-media and resized automatically on upload.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <ImageInput
                label="Photo"
                bucket="public-media"
                aspect="wide"
                maxSize={1600}
                value={editing.image}
                onChange={(image) => setEditing({ ...editing, image })}
              />
              <div>
                <Label htmlFor="g-title">Title *</Label>
                <Input
                  id="g-title"
                  className="mt-1.5"
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
                      setEditing({ ...editing, category: v as GalleryCategory })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GALLERY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="g-date">Event date</Label>
                  <Input
                    id="g-date"
                    type="date"
                    className="mt-1.5"
                    value={editing.event_date}
                    onChange={(e) => setEditing({ ...editing, event_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="g-desc">Caption / description (optional)</Label>
                <Textarea
                  id="g-desc"
                  rows={3}
                  className="mt-1.5"
                  value={editing.caption}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editing.is_published}
                  onCheckedChange={(c) => setEditing({ ...editing, is_published: c === true })}
                />
                Show on public Gallery page
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="navy" onClick={() => void save()} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
