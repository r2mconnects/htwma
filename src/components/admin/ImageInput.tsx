import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/StorageImage";
import type { StorageBucket } from "@/lib/data/types";
import { resizeImage, validateImageFile } from "@/lib/image";
import { cn } from "@/lib/utils";

export interface ImageValue {
  /** Existing stored path (kept unless replaced/removed). */
  path: string | null;
  /** New processed file to upload on save. */
  file: Blob | null;
  removed: boolean;
}

export const emptyImage = (path: string | null = null): ImageValue => ({ path, file: null, removed: false });

/** Image picker with preview, replacement, removal and validation. */
export function ImageInput({
  label,
  bucket,
  value,
  onChange,
  maxSize = 800,
  aspect = "portrait",
  hint,
}: {
  label: string;
  bucket: StorageBucket;
  value: ImageValue;
  onChange: (v: ImageValue) => void;
  maxSize?: number;
  aspect?: "portrait" | "wide";
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const blob = await resizeImage(file, maxSize);
      onChange({ ...value, file: blob, removed: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use this image");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  const hasImage = !!preview || (!!value.path && !value.removed);
  const box = aspect === "portrait" ? "h-40 w-32" : "h-24 w-56";

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-end gap-4">
        <div className={cn("overflow-hidden rounded-xl border-2 border-dashed bg-muted", box)}>
          {preview ? (
            <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : value.path && !value.removed ? (
            <StorageImage bucket={bucket} path={value.path} alt={label} className="h-full w-full" />
          ) : (
            <button type="button" onClick={() => ref.current?.click()} className="grid h-full w-full place-items-center text-muted-foreground hover:text-primary">
              <ImagePlus className="size-8" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
            {hasImage ? <RefreshCw /> : <ImagePlus />} {hasImage ? "Replace" : "Upload"}
          </Button>
          {hasImage && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange({ ...value, file: null, removed: true })}>
              <Trash2 /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint ?? "JPG, PNG or WebP, up to 8 MB."}</p>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

/** Uploads/removes as needed and returns the final stored path. */
export async function commitImage(
  value: ImageValue,
  bucket: StorageBucket,
  upload: (b: StorageBucket, f: Blob, n: string) => Promise<string>,
  remove: (b: StorageBucket, p: string) => Promise<void>,
): Promise<string | null> {
  if (value.file) {
    const path = await upload(bucket, value.file, "image.jpg");
    if (value.path) await remove(bucket, value.path).catch(() => undefined);
    return path;
  }
  if (value.removed) {
    if (value.path) await remove(bucket, value.path).catch(() => undefined);
    return null;
  }
  return value.path;
}
