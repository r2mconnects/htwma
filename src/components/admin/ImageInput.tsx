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

export const emptyImage = (path: string | null = null): ImageValue => ({
  path,
  file: null,
  removed: false,
});

/** Image picker with preview, replacement, removal and validation. */
export function ImageInput({
  label,
  bucket,
  value,
  onChange,
  maxSize = 800,
  aspect = "portrait",
  hint,
  onBusyChange,
  disabled = false,
}: {
  label: string;
  bucket: StorageBucket;
  value: ImageValue;
  onChange: (v: ImageValue) => void;
  maxSize?: number;
  aspect?: "portrait" | "wide";
  hint?: string;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!file || busy || disabled) return;
    setError(null);
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      if (ref.current) ref.current.value = "";
      toast.error(err);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const blob = await resizeImage(file, maxSize);
      onChange({ ...value, file: blob, removed: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not use this image";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => ref.current?.click()}
              className="grid h-full w-full place-items-center text-muted-foreground hover:text-primary"
            >
              <ImagePlus className="size-8" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ref.current?.click()}
            disabled={busy || disabled}
          >
            {hasImage ? <RefreshCw /> : <ImagePlus />} {hasImage ? "Replace" : "Upload"}
          </Button>
          {hasImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={busy || disabled}
              onClick={() => onChange({ ...value, file: null, removed: true })}
            >
              <Trash2 /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {hint ?? "JPG, PNG or WebP, up to 25 MB. Resized before upload."}
      </p>
      {busy && (
        <p role="status" className="text-xs">
          Processing image…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

export interface StagedUpload {
  bucket: StorageBucket;
  nextPath: string | null;
  uploadedNewPath: string | null;
  obsoleteOldPath: string | null;
}

/**
 * Stages a storage upload BEFORE database commit so old files are only removed
 * after the database transaction succeeds (and new uploads roll back on DB failure).
 */
export async function stageImageUpload(
  value: ImageValue,
  bucket: StorageBucket,
  upload: (b: StorageBucket, f: Blob, n: string) => Promise<string>,
  filename = "image.jpg",
): Promise<StagedUpload> {
  if (value.file) {
    const uploadedNewPath = await upload(bucket, value.file, filename);
    return {
      bucket,
      nextPath: uploadedNewPath,
      uploadedNewPath,
      obsoleteOldPath: value.path,
    };
  }
  if (value.removed) {
    return {
      bucket,
      nextPath: null,
      uploadedNewPath: null,
      obsoleteOldPath: value.path,
    };
  }
  return {
    bucket,
    nextPath: value.path,
    uploadedNewPath: null,
    obsoleteOldPath: null,
  };
}

export async function finalizeStagedUploads(
  staged: StagedUpload[],
  remove: (b: StorageBucket, p: string) => Promise<void>,
): Promise<void> {
  await Promise.all(
    staged
      .filter((s) => s.obsoleteOldPath)
      .map((s) => remove(s.bucket, s.obsoleteOldPath!).catch(() => undefined)),
  );
}

export async function rollbackStagedUploads(
  staged: StagedUpload[],
  remove: (b: StorageBucket, p: string) => Promise<void>,
): Promise<void> {
  await Promise.all(
    staged
      .filter((s) => s.uploadedNewPath)
      .map((s) => remove(s.bucket, s.uploadedNewPath!).catch(() => undefined)),
  );
}

/** Convenience helper for single-step image save. */
export async function commitImage(
  value: ImageValue,
  bucket: StorageBucket,
  upload: (b: StorageBucket, f: Blob, n: string) => Promise<string>,
  remove: (b: StorageBucket, p: string) => Promise<void>,
): Promise<string | null> {
  const staged = await stageImageUpload(value, bucket, upload);
  await finalizeStagedUploads([staged], remove);
  return staged.nextPath;
}
