import { Cog, Motorbike } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";
import { useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { cn } from "@/lib/utils";

/** Association emblem — displays uploaded official logo from public-media when configured. */
export function LogoMark({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "light";
}) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      aria-hidden="true"
    >
      <Cog
        className={cn(
          "absolute inset-0 size-full",
          tone === "light" ? "text-navy-foreground/70" : "text-brand",
        )}
        strokeWidth={1.6}
      />
      <Motorbike
        className={cn("relative size-[52%]", tone === "light" ? "text-gold" : "text-navy")}
        strokeWidth={2.2}
      />
    </span>
  );
}

export function Logo({
  tone = "default",
  compact = false,
}: {
  tone?: "default" | "light";
  compact?: boolean;
}) {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const markSize = compact ? "size-10" : "size-12 sm:size-14";

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {s.logo_path ? (
        <StorageImage
          bucket="public-media"
          path={s.logo_path}
          alt={s.short_name}
          className={cn("shrink-0 rounded-lg object-contain", markSize)}
        />
      ) : (
        <LogoMark className={markSize} tone={tone} />
      )}
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-display font-black tracking-tight",
            compact ? "text-2xl" : "text-3xl sm:text-[2.6rem]",
            tone === "light" ? "text-navy-foreground" : "text-navy",
          )}
        >
          {s.short_name || "HTWMA"}
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 hidden truncate text-[11px] font-medium sm:block sm:text-xs",
              tone === "light" ? "text-navy-foreground/80" : "text-navy",
            )}
          >
            {s.association_name}
          </span>
        )}
      </span>
    </span>
  );
}
