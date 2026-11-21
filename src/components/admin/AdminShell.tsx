import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Award,
  Images,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  ExternalLink,
  Printer,
} from "lucide-react";
import { db } from "@/lib/data";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/members", label: "Members", icon: Users, exact: true },
  { to: "/admin/members/new", label: "Add Member", icon: UserPlus, exact: true },
  { to: "/admin/committee", label: "Committee", icon: Award, exact: false },
  { to: "/admin/gallery", label: "Gallery", icon: Images, exact: false },
  { to: "/admin/import-export", label: "Import / Export", icon: FileSpreadsheet, exact: false },
  { to: "/admin/registration-form", label: "Blank Form", icon: Printer, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (to: string, exact: boolean) => {
    if (to === "/admin/members") return path === "/admin/members" || (/^\/admin\/members\/(?!new)/.test(path));
    return exact ? path === to : path.startsWith(to);
  };
  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
            isActive(n.to, n.exact)
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-card"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <n.icon className="size-[18px]" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await db.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  const sidebarBody = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/admin" onClick={onNavigate} className="px-1 pt-2">
        <Logo tone="light" compact />
      </Link>
      <NavList {...(onNavigate ? { onNavigate } : {})} />
      <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
        <Link to="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
          <ExternalLink className="size-[18px]" /> View website
        </Link>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="size-[18px]" /> Sign out
        </button>
        {db.kind === "local" && (
          <p className="px-3.5 pt-2 text-[11px] leading-snug text-sidebar-foreground/60">Local mode · data saved in this browser</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-muted/40 print:bg-card">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar lg:block print:hidden">{sidebarBody()}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open admin menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none bg-sidebar p-0">
              <SheetTitle className="sr-only">Admin menu</SheetTitle>
              {sidebarBody(() => setOpen(false))}
            </SheetContent>
          </Sheet>
          <Logo compact />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
