import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Mail, ShieldCheck } from "lucide-react";
import { useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { Logo } from "./Logo";
import { NAV_ITEMS } from "./SiteHeader";
import { SocialIcons } from "./SocialIcons";

export function SiteFooter() {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1.3fr] lg:px-8">
        <div className="space-y-4">
          <Logo tone="light" />
          <p className="max-w-sm text-sm leading-relaxed text-navy-foreground/80">
            {s.association_name}
          </p>
          <SocialIcons links={{ facebook: s.facebook_url, youtube: s.youtube_url, x: s.x_url }} />
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold">
            Quick links
          </h3>
          <ul className="space-y-2 text-sm">
            {NAV_ITEMS.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="text-navy-foreground/85 hover:text-gold">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold">Contact</h3>
          <ul className="space-y-3 text-sm text-navy-foreground/85">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {s.address}
            </li>
            {s.phone && (
              <li>
                <a href={`tel:+91${s.phone}`} className="flex gap-2 hover:text-gold">
                  <Phone className="mt-0.5 size-4 shrink-0" /> +91 {s.phone}
                </a>
              </li>
            )}
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className="flex gap-2 hover:text-gold">
                  <Mail className="mt-0.5 size-4 shrink-0" /> {s.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-navy-foreground/70 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} {s.short_name}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Member records are private and managed only by
            authorised administrators.
            <Link
              to="/admin/login"
              className="ml-2 underline-offset-2 hover:text-gold hover:underline"
            >
              Admin
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
