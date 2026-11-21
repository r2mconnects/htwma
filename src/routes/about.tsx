import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, Eye, History, CheckCircle2, ArrowRight } from "lucide-react";
import lepakshi from "@/assets/lepakshi-nandi.jpg.asset.json";
import { SiteLayout, PageBanner } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About HTWMA – Hindupur Two Wheelers Mechanic & Owners Association" },
      { name: "description", content: "Mission, vision and activities of the Hindupur Two Wheelers Mechanic & Owners Association." },
      { property: "og:title", content: "About HTWMA" },
      { property: "og:description", content: "Who we are and what the Hindupur two-wheeler mechanics association does." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const activities = s.activities.split("\n").map((a) => a.trim()).filter(Boolean);

  return (
    <SiteLayout>
      <PageBanner title="About Us" subtitle={s.association_name} />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <div className="h-1 w-12 rounded-full bg-primary" />
          <h2 className="mt-3 font-display text-3xl font-bold text-navy sm:text-4xl">Who we are</h2>
          <p className="mt-4 text-lg leading-relaxed text-foreground/85">{s.about_intro}</p>
          <p className="mt-4 leading-relaxed text-foreground/80">{s.home_intro}</p>
        </div>
        <figure>
          <img src={lepakshi.url} alt="The Lepakshi Nandi near Hindupur" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-float" />
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Lepakshi Nandi near Hindupur. Photo: Wikimedia Commons, CC BY-SA 3.0.
          </figcaption>
        </figure>
      </section>

      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-16 md:grid-cols-3 lg:px-8">
          {[
            { icon: Target, title: "Our Mission", text: s.mission },
            { icon: Eye, title: "Our Vision", text: s.vision },
            { icon: History, title: "Our History", text: s.history },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl bg-card p-7 shadow-card">
              <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
                <c.icon className="size-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-navy">{c.title}</h3>
              <p className="mt-2 leading-relaxed text-foreground/80">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-navy">Our Activities</h2>
        <div className="swoosh mt-3 w-28" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {activities.map((a) => (
            <li key={a} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
              <span className="text-foreground/85">{a}</span>
            </li>
          ))}
        </ul>
        <Button asChild variant="navy" size="lg" className="mt-10 px-6">
          <Link to="/committee">
            Meet the committee <ArrowRight />
          </Link>
        </Button>
      </section>
    </SiteLayout>
  );
}
