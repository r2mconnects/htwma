import { useRef, useState } from "react";
import { FileCheck2, FileUp, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/data";
import { resizeImage, validateDocumentFile } from "@/lib/image";
import type { StagedUpload } from "./ImageInput";

export interface DocumentValue {
  path: string | null;
  file: Blob | null;
  filename: string;
  removed: boolean;
}

export const emptyDocument = (path: string | null = null): DocumentValue => ({
  path,
  file: null,
  filename: "",
  removed: false,
});

/**
 * Private identity document uploader (PDF, JPG, PNG, WebP up to 10 MB).
 * Stored in the private `member-documents` bucket and accessed only via short-lived admin signed URLs.
 */
export function DocumentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DocumentValue;
  onChange: (v: DocumentValue) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    const err = validateDocumentFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      if (file.type === "application/pdf") {
        onChange({ ...value, file, filename: file.name, removed: false });
      } else {
        const resized = await resizeImage(file, 1600, 0.85);
        onChange({ ...value, file: resized, filename: "document.jpg", removed: false });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process document");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function openStored() {
    if (!value.path) return;
    const url = await db.files.getUrl("member-documents", value.path);
    if (!url) {
      toast.error("Could not generate secure document link");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const hasDoc = !!value.file || (!!value.path && !value.removed);

  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-navy">{label}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {value.file
              ? `Ready to save: ${value.filename || "Selected file"}`
              : value.path && !value.removed
                ? "Encrypted in private storage"
                : "No file uploaded (PDF/JPG/PNG)"}
          </p>
        </div>
        {hasDoc && <FileCheck2 className="size-4 shrink-0 text-success" />}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          {hasDoc ? "Replace" : "Attach"}
        </Button>
        {value.path && !value.removed && !value.file && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => void openStored()}
          >
            <ExternalLink className="size-3.5" /> View
          </Button>
        )}
        {hasDoc && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive"
            onClick={() => onChange({ path: value.path, file: null, filename: "", removed: true })}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

export async function stageDocumentUpload(
  value: DocumentValue,
  upload: (b: "member-documents", f: Blob, n: string) => Promise<string>,
): Promise<StagedUpload> {
  if (value.file) {
    const uploadedNewPath = await upload(
      "member-documents",
      value.file,
      value.filename || "document.jpg",
    );
    return {
      bucket: "member-documents",
      nextPath: uploadedNewPath,
      uploadedNewPath,
      obsoleteOldPath: value.path,
    };
  }
  if (value.removed) {
    return {
      bucket: "member-documents",
      nextPath: null,
      uploadedNewPath: null,
      obsoleteOldPath: value.path,
    };
  }
  return {
    bucket: "member-documents",
    nextPath: value.path,
    uploadedNewPath: null,
    obsoleteOldPath: null,
  };
}
