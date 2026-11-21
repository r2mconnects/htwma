import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="relative overflow-hidden bg-navy-gradient text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20 lg:px-8">
        <nav className="mb-4 flex items-center gap-1 text-sm text-navy-foreground/75" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-gold">
            Home
          </Link>
          <ChevronRight className="size-4" />
          <span className="text-navy-foreground">{title}</span>
        </nav>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <div className="swoosh mt-4 w-40" />
        <p className="mt-5 max-w-2xl text-lg text-navy-foreground/85">{subtitle}</p>
      </div>
    </section>
  );
}
