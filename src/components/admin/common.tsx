import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { MemberStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "active" && "border-success/40 bg-success/10 text-success",
        status === "inactive" && "border-warning/40 bg-warning/10 text-warning",
        status === "archived" && "border-muted-foreground/30 bg-muted text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">{icon}</div>
      <h3 className="mt-4 font-semibold text-navy">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({ title, description, children, className, actions }: { title: string; description?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card sm:p-6", className)}>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap justify-end gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function LoadingBlock() {
  return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
}
