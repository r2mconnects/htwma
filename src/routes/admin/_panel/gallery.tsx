import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Images, Loader2 } from "lucide-react";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageInput, commitImage, emptyImage, type ImageValue } from "@/components/admin/ImageInput";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/data";
import { qk, useGallery, useInvalidate } from "@/lib/data/hooks";
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from "@/lib/data/types";
import { resizeImage, validateImageFile } from "@/lib/image";

export const Route = createFileRoute("/admin/_panel/gallery")({
  head: () => ({ meta: [{ title: "Gallery – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: GalleryAdmin,
});

type Draft = Omit<GalleryItem, "image_path" | "created_at" | "is_demo"> & { image: ImageValue };

function GalleryAdmin() {
  const { data, isLoading } = useGallery();
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const items = data ?? [];
  const refresh = () => invalidate(qk.gallery, qk.publishedGallery);

  async function uploadMany(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(list.length);
    let ok = 0;
    for (const [i, file] of list.entries()) {
      const err = validateImageFile(file);
      if (err) { toast.error(`${file.name}: ${err}`); continue; }
      try {
        const blob = await resizeImage(file, 1600, 0.82);
        const path = await db.files.upload("public-media", blob, "photo.jpg");
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 80);
        await db.gallery.create({
          image_path: path, title, caption: "", category: "Office", event_date: null, alt_text: title,
          credit: "", is_published: false, display_order: items.length + i + 1,
        });
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setUploading(0);
    if (input.current) input.current.value = "";
    await refresh();
    if (ok) toast.success(`${ok} photo(s) uploaded as unpublished. Add details, then publish.`);
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = items.map((g) => g.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await db.gallery.reorder(ids);
    await refresh();
  }

  async function togglePublish(g: GalleryItem) {
    await db.gallery.update(g.id, { is_published: !g.is_published });
    await refresh();
    toast.success(g.is_published ? "Unpublished" : "Published on website");
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Add a title");
    const original = items.find((g) => g.id === draft.id);
    const image_path = draft.image.file
      ? await commitImage(draft.image, "public-media", db.files.upload, db.files.remove)
      : original?.image_path ?? "";
    const { image: _image, id, ...rest } = draft;
    await db.gallery.update(id, { ...rest, title: rest.title.trim(), image_path: image_path ?? "" });
    await refresh();
    setDraft(null);
    toast.success("Photo saved");
  }

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Gallery"
        description="Upload office, meeting and event photos. Only published photos appear on the website."
        actions={
          <Button variant="navy" onClick={() => input.current?.click()} disabled={uploading > 0}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? `Uploading ${uploading}…` : "Upload photos"}
          </Button>
        }
      />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void uploadMany(e.target.files)} />

      {items.length === 0 ? (
        <EmptyState icon={<Images className="size-6" />} title="No photos yet" text="Upload association photos. Get consent before publishing photos of identifiable people." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g, i) => (
            <div key={g.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="relative">
                <StorageImage bucket="public-media" path={g.image_path} alt={g.alt_text || g.title} className="aspect-[4/3] w-full" />
                <Badge className={`absolute left-2 top-2 ${g.is_published ? "bg-success text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {g.is_published ? "Published" : "Draft"}
                </Badge>
              </div>
              <div className="p-4">
                <p className="truncate font-medium text-navy">{g.title}</p>
                <p className="text-xs text-muted-foreground">{g.category}{g.event_date ? ` · ${g.event_date}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => void togglePublish(g)}>
                    {g.is_published ? <><EyeOff /> Unpublish</> : <><Eye /> Publish</>}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDraft({ ...g, image: emptyImage(g.image_path) })} aria-label="Edit"><Pencil /></Button>
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => void move(g.id, -1)} aria-label="Move up"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" disabled={i === items.length - 1} onClick={() => void move(g.id, 1)} aria-label="Move down"><ArrowDown /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="ml-auto text-destructive" aria-label="Delete"><Trash2 /></Button>}
                    title="Delete this photo?"
                    description={<p>"{g.title}" will be removed permanently.</p>}
                    confirmLabel="Delete"
                    onConfirm={async () => { await db.gallery.remove(g.id); await refresh(); toast.success("Photo deleted"); }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit photo</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <ImageInput label="Image" bucket="public-media" value={draft.image} onChange={(v) => setDraft({ ...draft, image: v.removed ? emptyImage(draft.image.path) : v })} aspect="wide" maxSize={1600} hint="Replace the image if needed." />
              <div><Label htmlFor="gt">Title</Label><Input id="gt" className="mt-1.5" maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label htmlFor="gc">Caption</Label><Textarea id="gc" className="mt-1.5" maxLength={300} value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as GalleryCategory })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{GALLERY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="gd">Event date</Label><Input id="gd" type="date" className="mt-1.5" value={draft.event_date ?? ""} onChange={(e) => setDraft({ ...draft, event_date: e.target.value || null })} /></div>
              </div>
              <div><Label htmlFor="ga">Alt text (describes the photo for screen readers)</Label><Input id="ga" className="mt-1.5" maxLength={160} value={draft.alt_text} onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })} /></div>
              <div><Label htmlFor="gr">Photo credit / source</Label><Input id="gr" className="mt-1.5" maxLength={120} value={draft.credit} onChange={(e) => setDraft({ ...draft, credit: e.target.value })} /></div>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                Published on website
                <Switch checked={draft.is_published} onCheckedChange={(c) => setDraft({ ...draft, is_published: c })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="navy" onClick={() => void saveDraft()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
