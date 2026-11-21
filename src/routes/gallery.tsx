import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, CalendarDays } from "lucide-react";
import { SiteLayout, PageBanner } from "@/components/site/SiteLayout";
import { StorageImage } from "@/components/StorageImage";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePublishedGallery } from "@/lib/data/hooks";
import { GALLERY_CATEGORIES } from "@/lib/data/types";
import { formatDate } from "@/lib/members";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery – HTWMA Hindupur" },
      { name: "description", content: "Photos of HTWMA office, meetings, events and association activities in Hindupur." },
      { property: "og:title", content: "HTWMA Gallery" },
      { property: "og:description", content: "Moments that bring the Hindupur two-wheeler community together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { data, isLoading } = usePublishedGallery();
  const [cat, setCat] = useState<string>("All");
  const [index, setIndex] = useState<number | null>(null);
  const items = (data ?? []).filter((g) => cat === "All" || g.category === cat);
  const current = index !== null ? items[index] : undefined;
  const cats = ["All", ...GALLERY_CATEGORIES.filter((c) => (data ?? []).some((g) => g.category === c))];

  return (
    <SiteLayout>
      <PageBanner title="Gallery" subtitle="Moments from our office, meetings, events and activities." />
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Photo categories">
          {cats.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                cat === c ? "bg-primary text-primary-foreground" : "bg-secondary text-navy hover:bg-accent",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <p className="mt-8 rounded-2xl border bg-card p-10 text-center text-muted-foreground">No photos published yet.</p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setIndex(i)}
              className="group relative overflow-hidden rounded-2xl text-left shadow-card focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StorageImage bucket="public-media" path={g.image_path} alt={g.alt_text || g.title} className="aspect-[4/3] w-full transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-navy/80 px-3 py-2 text-sm font-medium text-navy-foreground">
                {g.title}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Photos marked "Placeholder" are temporary stock images and do not show the association.
        </p>
      </section>

      <Dialog open={!!current} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 [&>button]:hidden">
          {current && (
            <>
              <div className="relative bg-navy">
                <StorageImage bucket="public-media" path={current.image_path} alt={current.alt_text || current.title} className="max-h-[70vh] w-full object-contain" />
                <Button size="icon" variant="onNavy" className="absolute right-3 top-3" onClick={() => setIndex(null)} aria-label="Close">
                  <X />
                </Button>
                {items.length > 1 && (
                  <>
                    <Button size="icon" variant="onNavy" className="absolute left-3 top-1/2 -translate-y-1/2" aria-label="Previous"
                      onClick={() => setIndex(((index ?? 0) - 1 + items.length) % items.length)}>
                      <ChevronLeft />
                    </Button>
                    <Button size="icon" variant="onNavy" className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Next"
                      onClick={() => setIndex(((index ?? 0) + 1) % items.length)}>
                      <ChevronRight />
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-1 p-5">
                <DialogTitle className="text-navy">{current.title}</DialogTitle>
                <DialogDescription>{current.caption}</DialogDescription>
                <p className="flex flex-wrap gap-x-4 pt-1 text-xs text-muted-foreground">
                  <span>{current.category}</span>
                  {current.event_date && (
                    <span className="flex items-center gap-1"><CalendarDays className="size-3" /> {formatDate(current.event_date)}</span>
                  )}
                  {current.credit && <span>Photo: {current.credit}</span>}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}
