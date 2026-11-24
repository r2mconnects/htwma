import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { SiteLayout, PageBanner } from "@/components/site/SiteLayout";
import { StorageImage } from "@/components/StorageImage";
import { usePublicCommittee } from "@/lib/data/hooks";
import type { PublicCommitteeEntry } from "@/lib/data/types";

export const Route = createFileRoute("/committee")({
  head: () => ({
    meta: [
      { title: "Committee – HTWMA Hindupur" },
      {
        name: "description",
        content: "President, office-bearers and executive committee members of HTWMA, Hindupur.",
      },
      { property: "og:title", content: "HTWMA Committee" },
      {
        property: "og:description",
        content:
          "Meet the office-bearers of the Hindupur Two Wheelers Mechanic & Owners Association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommitteePage,
});

function CommitteeCard({ c, large }: { c: PublicCommitteeEntry; large: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-card p-6 text-center shadow-card transition hover:-translate-y-1">
      <StorageImage
        bucket="public-media"
        path={c.photo_path}
        alt={c.name}
        fallbackName={c.name}
        className={`${large ? "size-28 text-3xl" : "size-24 text-2xl"} rounded-full ring-4 ring-sky`}
      />
      <span className="mt-4 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
        {c.role_name}
      </span>
      <h3 className="mt-2 font-display text-xl font-bold text-navy">{c.name}</h3>
      {c.phone && (
        <a
          href={`tel:+91${c.phone}`}
          className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <Phone className="size-4" /> {c.phone}
        </a>
      )}
    </div>
  );
}

function CommitteePage() {
  const { data, isLoading } = usePublicCommittee();
  const list = data ?? [];
  const bearers = list.filter((c) => c.role_name !== "Executive Committee Member");
  const exec = list.filter((c) => c.role_name === "Executive Committee Member");

  return (
    <SiteLayout>
      <PageBanner
        title="Committee"
        subtitle="The office-bearers and executive committee members who lead HTWMA."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}
        {!isLoading && list.length === 0 && (
          <p className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
            Committee details will be published soon.
          </p>
        )}
        {bearers.length > 0 && (
          <>
            <h2 className="font-display text-3xl font-bold text-navy">Office-Bearers</h2>
            <div className="swoosh mt-3 w-28" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {bearers.map((c) => (
                <CommitteeCard key={c.id} c={c} large />
              ))}
            </div>
          </>
        )}
        {exec.length > 0 && (
          <>
            <h2 className="mt-16 font-display text-3xl font-bold text-navy">
              Executive Committee Members
            </h2>
            <div className="swoosh mt-3 w-28" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {exec.map((c) => (
                <CommitteeCard key={c.id} c={c} large={false} />
              ))}
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
