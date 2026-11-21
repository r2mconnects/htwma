import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Info, Users, Images, Mail, MapPin, Phone, Menu, LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { Logo } from "./Logo";
import { SocialIcons } from "./SocialIcons";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/about", label: "About", icon: Info },
  { to: "/committee", label: "Committee", icon: Users },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/contact", label: "Contact", icon: Mail },
] as const;

export function SiteHeader() {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-30">
      <div className="bg-navy text-navy-foreground">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:text-sm lg:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">{s.location_label}</span>
            </span>
            {s.phone && (
              <a href={`tel:+91${s.phone}`} className="hidden items-center gap-1.5 hover:text-gold sm:flex">
                <Phone className="size-4" /> +91 {s.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
              </a>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="hidden items-center gap-1.5 hover:text-gold md:flex">
                <Mail className="size-4" /> {s.email}
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden font-medium italic text-gold lg:inline">{s.tagline}</span>
            <SocialIcons links={{ facebook: s.facebook_url, youtube: s.youtube_url, x: s.x_url }} />
          </div>
        </div>
      </div>

      <div className="border-b bg-card">
        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:h-24 lg:flex lg:justify-between lg:px-8">
          <Link to="/" className="min-w-0" aria-label="HTWMA home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition",
                    active ? "bg-primary text-primary-foreground shadow-card" : "text-navy hover:bg-secondary",
                  )}
                >
                  <item.icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="navy" size="lg" className="hidden px-6 lg:inline-flex">
              <Link to="/admin/login">
                <LogIn /> Admin Login
              </Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="text-left text-navy">Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-2 flex flex-col gap-1 px-4" aria-label="Mobile">
                  {NAV_ITEMS.map((item) => {
                    const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 font-medium",
                          active ? "bg-primary text-primary-foreground" : "text-navy hover:bg-secondary",
                        )}
                      >
                        <item.icon className="size-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button asChild variant="navy" size="lg" className="mt-4">
                    <Link to="/admin/login" onClick={() => setOpen(false)}>
                      <LogIn /> Admin Login
                    </Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
