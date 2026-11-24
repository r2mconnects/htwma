import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Users,
  UsersRound,
  Images,
  Newspaper,
  PhoneCall,
  Handshake,
  Motorbike,
  HeartHandshake,
  Wrench,
  Scale,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import heroAsset from "@/assets/htwma-hero.png";
import lepakshi from "@/assets/lepakshi-nandi.jpg";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/StorageImage";
import { usePublicCommittee, usePublishedGallery, useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { formatDate } from "@/lib/members";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HTWMA – Hindupur Two Wheeler Mechanics & Owners Association" },
      {
        name: "description",
        content:
          "HTWMA unites two-wheeler mechanics and owners of Hindupur for welfare, skill development and a stronger community.",
      },
      { property: "og:title", content: "HTWMA – Together for a Stronger Two Wheeler Community" },
      {
        property: "og:description",
        content: "Empowering mechanics, supporting owners and building a better Hindupur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const QUICK_LINKS = [
  { to: "/about", title: "Our Association", sub: "About HTWMA", icon: UsersRound, hash: undefined },
  { to: "/committee", title: "Committee", sub: "Our Team", icon: Users, hash: undefined },
  { to: "/gallery", title: "Gallery", sub: "Photos & Events", icon: Images, hash: undefined },
  { to: "/", title: "Updates", sub: "Latest News", icon: Newspaper, hash: "updates" },
  { to: "/contact", title: "Contact Us", sub: "Get in Touch", icon: PhoneCall, hash: undefined },
] as const;

const HIGHLIGHTS = [
  { icon: HeartHandshake, title: "Member Welfare", text: "Standing together for members and their families in times of need." },
  { icon: GraduationCap, title: "Skill Development", text: "Keeping mechanics up to date with new vehicles and technology." },
  { icon: Scale, title: "Fair Practices", text: "Encouraging honest, quality service that owners can trust." },
  { icon: Wrench, title: "One Strong Voice", text: "Representing the common concerns of Hindupur's two-wheeler trade." },
];

function HomePage() {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const gallery = usePublishedGallery();
  const committee = usePublicCommittee();
  const photos = (gallery.data ?? []).slice(0, 3);
  const leaders = (committee.data ?? []).slice(0, 4);

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-hero">
        <div className="relative lg:hidden">
          <img src={heroAsset} alt="A mechanic servicing a motorcycle in a workshop" className="h-64 w-full object-cover sm:h-80" />
        </div>
        <div className="absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <div className="hero-curve absolute inset-0 -left-4 bg-primary" />
          <img
            src={heroAsset}
            alt="A mechanic servicing a motorcycle in a workshop"
            className="hero-curve absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-10 sm:pb-32 lg:min-h-[560px] lg:px-8 lg:pb-36 lg:pt-12">
          <div className="max-w-xl lg:max-w-[46%]">
            <h1 className="font-display text-3xl font-bold leading-tight text-navy sm:text-4xl xl:text-[2.6rem]">
              Hindupur Two Wheeler Mechanics &amp; Owners Association
            </h1>
            <p className="mt-1 font-display text-6xl font-black italic tracking-tight text-brand sm:text-7xl xl:text-8xl">
              {s.short_name}
            </p>
            <div className="swoosh mt-1 w-full max-w-md" />
            <p className="mt-6 font-display text-2xl font-bold italic leading-snug text-navy sm:text-3xl">
              Together for a Stronger
              <br />
              Two Wheeler Community
            </p>
            <p className="mt-4 text-lg text-navy/85">
              Empowering Mechanics, Supporting Owners,
              <br className="hidden sm:block" /> Building a Better Hindupur
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="navy" size="xl">
                <Link to="/contact">
                  <Users /> Become a Member <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="navyOutline" size="xl">
                <Link to="/gallery">
                  <Images /> View Gallery
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="relative z-10 mx-auto -mt-20 max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-float sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_LINKS.map((q, i) => (
            <Link
              key={q.title}
              to={q.to}
              {...(q.hash ? { hash: q.hash } : {})}
              className={`group flex flex-col items-center gap-2 px-3 py-6 text-center transition hover:bg-secondary ${i > 0 ? "lg:border-l" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <q.icon className="size-10 text-primary transition group-hover:scale-110" strokeWidth={1.8} />
              <span className="font-semibold text-navy">{q.title}</span>
              <span className="-mt-1.5 text-sm text-muted-foreground">{q.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ABOUT + GALLERY PREVIEW */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[1fr_1.05fr_1.35fr] lg:items-center lg:px-8">
        <img
          src={lepakshi}
          alt="The Lepakshi Nandi near Hindupur"
          className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card"
          loading="lazy"
        />
        <div>
          <div className="h-1 w-12 rounded-full bg-primary" />
          <h2 className="mt-3 font-display text-3xl font-bold text-navy">About {s.short_name}</h2>
          <p className="mt-3 leading-relaxed text-foreground/85">{s.home_intro}</p>
          <Button asChild variant="navy" className="mt-5 px-6">
            <Link to="/about">
              Know More <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="rounded-2xl bg-sky p-5 shadow-card">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Images className="size-9 shrink-0 text-primary" />
              <div className="min-w-0">
                <h2 className="truncate font-display text-2xl font-bold text-navy">Our Gallery</h2>
                <p className="truncate text-sm text-navy/75">Moments that bring us together</p>
              </div>
            </div>
            <Button asChild variant="navy" size="sm" className="px-4">
              <Link to="/gallery">
                View All <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.length === 0
              ? [0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-card/70" />)
              : photos.map((p) => (
                  <Link key={p.id} to="/gallery" className="overflow-hidden rounded-lg">
                    <StorageImage
                      bucket="public-media"
                      path={p.image_path}
                      alt={p.alt_text || p.title}
                      className="aspect-[4/3] w-full transition duration-300 hover:scale-105"
                    />
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* STRONGER TOGETHER BAND */}
      <section className="relative overflow-hidden bg-navy-gradient text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-8 lg:px-8">
          <Handshake className="size-14 shrink-0 sm:size-16" strokeWidth={1.6} />
          <p className="font-display text-2xl font-bold italic sm:text-4xl">Stronger Together – {s.short_name}</p>
          <Motorbike className="absolute -right-4 bottom-0 hidden size-36 text-navy-foreground/25 md:block" strokeWidth={1.2} />
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-navy sm:text-4xl">What We Stand For</h2>
          <div className="swoosh mx-auto mt-3 w-32" />
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-xl bg-secondary text-primary">
                <h.icon className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-navy">{h.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMITTEE PREVIEW + UPDATES */}
      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.4fr_1fr] lg:px-8">
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-3xl font-bold text-navy">Our Committee</h2>
                <p className="mt-1 text-muted-foreground">The office-bearers leading the association.</p>
              </div>
              <Button asChild variant="link" className="px-0">
                <Link to="/committee">
                  See all <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {leaders.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card">
                  <StorageImage
                    bucket="public-media"
                    path={c.photo_path}
                    alt={c.name}
                    fallbackName={c.name}
                    className="size-14 shrink-0 rounded-full text-lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{c.name}</p>
                    <p className="truncate text-sm text-primary">{c.role_name}</p>
                  </div>
                </div>
              ))}
              {leaders.length === 0 && <p className="text-sm text-muted-foreground">Committee details coming soon.</p>}
            </div>
          </div>

          <div id="updates" className="scroll-mt-24">
            <h2 className="font-display text-3xl font-bold text-navy">Latest Updates</h2>
            <p className="mt-1 text-muted-foreground">News and notices from the association.</p>
            <div className="mt-6 space-y-4">
              {s.updates.length === 0 && <p className="text-sm text-muted-foreground">No updates right now.</p>}
              {s.updates.map((u) => (
                <article key={u.id} className="rounded-2xl border-l-4 border-primary bg-card p-5 shadow-card">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CalendarDays className="size-3.5" /> {formatDate(u.date)}
                  </p>
                  <h3 className="mt-1 font-semibold text-navy">{u.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">{u.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-navy-gradient p-8 text-navy-foreground shadow-float sm:p-12 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold">Want to join or get in touch?</h2>
            <p className="mt-2 max-w-xl text-navy-foreground/85">
              Membership registration is done at the association office. Call or message us and the committee will guide you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="gold" size="xl">
              <Link to="/contact">
                <PhoneCall /> Contact Us
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
