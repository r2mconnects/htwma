import type { StorageBucket } from "@/lib/data/types";
import { useFileUrl } from "@/lib/data/hooks";
import { initials } from "@/lib/members";
import { cn } from "@/lib/utils";

/** Shows a stored image (local IndexedDB, Supabase signed URL, or direct URL). */
export function StorageImage({
  bucket,
  path,
  alt,
  className,
  fallbackName,
}: {
  bucket: StorageBucket;
  path: string | null;
  alt: string;
  className?: string;
  fallbackName?: string;
}) {
  const { data: url, isLoading } = useFileUrl(bucket, path);
  if (url) return <img src={url} alt={alt} className={cn("object-cover", className)} loading="lazy" />;
  return (
    <div
      className={cn(
        "grid place-items-center bg-secondary font-display font-bold text-navy",
        isLoading && path && "animate-pulse",
        className,
      )}
      aria-label={alt}
      role="img"
    >
      {fallbackName ? initials(fallbackName) : ""}
    </div>
  );
}
