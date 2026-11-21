import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MapPin, Phone, Mail, Clock, MessageCircle, ExternalLink, Send } from "lucide-react";
import { SiteLayout, PageBanner } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS, isPlaceholder } from "@/lib/data/defaults";
import { isValidIndianMobile } from "@/lib/members";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact HTWMA – Hindupur" },
      { name: "description", content: "Address, phone and WhatsApp for the Hindupur Two Wheelers Mechanic & Owners Association." },
      { property: "og:title", content: "Contact HTWMA" },
      { property: "og:description", content: "Get in touch with the Hindupur two-wheeler mechanics association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z.string().trim().refine((v) => !v || isValidIndianMobile(v), "Enter a valid 10-digit mobile number"),
  message: z.string().trim().min(5, "Please write a short message").max(800),
});

function ContactPage() {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const wa = s.whatsapp || s.phone;

  function send(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    const text = `Hello HTWMA,\n\n${r.data.message}\n\n— ${r.data.name}${r.data.phone ? ` (${r.data.phone})` : ""}`;
    window.open(`https://wa.me/91${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  const cards = [
    { icon: MapPin, title: "Office Address", value: s.address, href: s.map_url || null },
    { icon: Phone, title: "Phone", value: s.phone ? `+91 ${s.phone}` : "", href: s.phone ? `tel:+91${s.phone}` : null },
    { icon: MessageCircle, title: "WhatsApp", value: wa ? `+91 ${wa}` : "", href: wa ? `https://wa.me/91${wa}` : null },
    { icon: Mail, title: "Email", value: s.email || "[Placeholder] Email to be confirmed", href: s.email ? `mailto:${s.email}` : null },
    { icon: Clock, title: "Office Hours", value: s.office_hours, href: null },
  ].filter((c) => c.value);

  return (
    <SiteLayout>
      <PageBanner title="Contact Us" subtitle="Visit the association office, call, or send us a WhatsApp message." />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.1fr] lg:px-8">
        <div className="space-y-4">
          {cards.map((c) => {
            const body = (
              <div className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-card transition hover:border-primary">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <c.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{c.title}</p>
                  <p className={`mt-0.5 break-words ${isPlaceholder(c.value) ? "italic text-muted-foreground" : "text-foreground/85"}`}>{c.value}</p>
                </div>
                {c.href && <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />}
              </div>
            );
            return c.href ? (
              <a key={c.title} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="block">
                {body}
              </a>
            ) : (
              <div key={c.title}>{body}</div>
            );
          })}
        </div>

        <form onSubmit={send} className="rounded-3xl bg-card p-6 shadow-float sm:p-8" noValidate>
          <h2 className="font-display text-2xl font-bold text-navy">Send us a message</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your message opens in WhatsApp so the committee can reply to you directly.</p>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="c-name">Your name</Label>
              <Input id="c-name" className="mt-1.5" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors["name"]} />
              {errors["name"] && <p className="mt-1 text-sm text-destructive">{errors["name"]}</p>}
            </div>
            <div>
              <Label htmlFor="c-phone">Mobile number <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="c-phone" className="mt-1.5" inputMode="tel" value={form.phone} maxLength={14} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors["phone"]} />
              {errors["phone"] && <p className="mt-1 text-sm text-destructive">{errors["phone"]}</p>}
            </div>
            <div>
              <Label htmlFor="c-msg">Message</Label>
              <Textarea id="c-msg" className="mt-1.5 min-h-32" value={form.message} maxLength={800} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-invalid={!!errors["message"]} />
              {errors["message"] && <p className="mt-1 text-sm text-destructive">{errors["message"]}</p>}
            </div>
            <Button type="submit" variant="navy" size="xl" className="w-full">
              <Send /> Send via WhatsApp
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Please do not send Aadhaar, PAN or licence numbers through this form.
          </p>
        </form>
      </section>
    </SiteLayout>
  );
}
