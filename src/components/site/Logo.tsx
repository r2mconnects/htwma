import { Cog, Motorbike } from "lucide-react";
import { cn } from "@/lib/utils";

/** Placeholder emblem until the association supplies its official logo. */
export function LogoMark({ className, tone = "default" }: { className?: string; tone?: "default" | "light" }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} aria-hidden="true">
      <Cog className={cn("absolute inset-0 size-full", tone === "light" ? "text-navy-foreground/70" : "text-brand")} strokeWidth={1.6} />
      <Motorbike className={cn("relative size-[52%]", tone === "light" ? "text-gold" : "text-navy")} strokeWidth={2.2} />
    </span>
  );
}

export function Logo({ tone = "default", compact = false }: { tone?: "default" | "light"; compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark className={compact ? "size-10" : "size-12 sm:size-14"} tone={tone} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-display font-black tracking-tight",
            compact ? "text-2xl" : "text-3xl sm:text-[2.6rem]",
            tone === "light" ? "text-navy-foreground" : "text-navy",
          )}
        >
          HTWMA
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 hidden truncate text-[11px] font-medium sm:block sm:text-xs",
              tone === "light" ? "text-navy-foreground/80" : "text-navy",
            )}
          >
            Hindupur Two Wheeler Mechanics &amp; Owners Association
          </span>
        )}
      </span>
    </span>
  );
}
