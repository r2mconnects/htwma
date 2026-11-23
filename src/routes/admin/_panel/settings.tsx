import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Plus, Trash2, Download, Upload, KeyRound, Database, History, Loader2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_TIME, DateRangeFilter, resolveRange, type RangeState } from "@/components/admin/DateRangeFilter";
import { inRange, parseAmount } from "@/lib/fees";
import { PageHeader, Section, LoadingBlock } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CONFIGURABLE_FIELD_LABELS } from "@/components/admin/MemberForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/data";
import { qk, useInvalidate, useSettings } from "@/lib/data/hooks";
import { isPlaceholder } from "@/lib/data/defaults";
import { FEE_TYPES, type ConfigurableField, type FeeType, type SiteSettings } from "@/lib/data/types";

export const Route = createFileRoute("/admin/_panel/settings")({
  head: () => ({ meta: [{ title: "Settings – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isPlaceholderData } = useSettings();
  if (!data || isPlaceholderData) return <LoadingBlock />;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Website content, member form rules, your account and data tools." />
      <Tabs defaultValue="site">
        <TabsList className="mb-5 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="site">Website</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="form">Member form</TabsTrigger>
          <TabsTrigger value="fees">Fee amounts</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="data">Data & backup</TabsTrigger>
          <TabsTrigger value="log">Activity log</TabsTrigger>
        </TabsList>
        <TabsContent value="site"><SiteTab initial={data} /></TabsContent>
        <TabsContent value="updates"><UpdatesTab initial={data} /></TabsContent>
        <TabsContent value="form"><FormTab initial={data} /></TabsContent>
        <TabsContent value="fees"><FeeAmountsTab initial={data} /></TabsContent>
        <TabsContent value="account"><AccountTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
        <TabsContent value="log"><LogTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function useSave() {
  const invalidate = useInvalidate();
  return async (patch: Partial<SiteSettings>) => {
    try {
      await db.content.updateSettings(patch);
      await invalidate(qk.settings);
      toast.success("Saved — website updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };
}

const TEXT_FIELDS: Array<{ key: keyof SiteSettings; label: string; long?: boolean; group: string }> = [
  { key: "association_name", label: "Full association name", group: "Identity" },
  { key: "short_name", label: "Short name", group: "Identity" },
  { key: "tagline", label: "Tagline", group: "Identity" },
  { key: "location_label", label: "Location (top bar)", group: "Contact" },
  { key: "address", label: "Office address", long: true, group: "Contact" },
  { key: "phone", label: "Phone (10 digits)", group: "Contact" },
  { key: "whatsapp", label: "WhatsApp (10 digits)", group: "Contact" },
  { key: "email", label: "Email", group: "Contact" },
  { key: "office_hours", label: "Office hours", group: "Contact" },
  { key: "map_url", label: "Google Maps link", group: "Contact" },
  { key: "facebook_url", label: "Facebook page URL", group: "Social" },
  { key: "youtube_url", label: "YouTube channel URL", group: "Social" },
  { key: "x_url", label: "X (Twitter) URL", group: "Social" },
  { key: "home_intro", label: "Home page introduction", long: true, group: "Page text" },
  { key: "about_intro", label: "About — who we are", long: true, group: "Page text" },
  { key: "mission", label: "Mission", long: true, group: "Page text" },
  { key: "vision", label: "Vision", long: true, group: "Page text" },
  { key: "history", label: "History", long: true, group: "Page text" },
  { key: "activities", label: "Activities (one per line)", long: true, group: "Page text" },
  { key: "form_code", label: "Registration form heading", group: "Page text" },
];

function SiteTab({ initial }: { initial: SiteSettings }) {
  const save = useSave();
  const [v, setV] = useState(initial);
  const groups = [...new Set(TEXT_FIELDS.map((f) => f.group))];

  function submit() {
    for (const k of ["phone", "whatsapp"] as const) {
      if (v[k] && !/^[6-9]\d{9}$/.test(v[k])) { toast.error(`${k === "phone" ? "Phone" : "WhatsApp"} must be a 10-digit number`); return; }
    }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { toast.error("Email looks wrong"); return; }
    for (const k of ["map_url", "facebook_url", "youtube_url", "x_url"] as const) {
      if (v[k] && !/^https:\/\//.test(v[k])) { toast.error("Links must start with https://"); return; }
    }
    const patch: Partial<SiteSettings> = {};
    TEXT_FIELDS.forEach((f) => ((patch as Record<string, unknown>)[f.key] = String(v[f.key]).trim()));
    void save(patch);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <Section key={g} title={g}>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.filter((f) => f.group === g).map((f) => {
              const val = String(v[f.key] ?? "");
              return (
                <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
                  <Label htmlFor={f.key} className="flex items-center gap-2">
                    {f.label}
                    {isPlaceholder(val) && ["email", "office_hours", "history"].includes(f.key) && (
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">To confirm</span>
                    )}
                  </Label>
                  {f.long ? (
                    <Textarea id={f.key} className="mt-1.5" rows={f.key === "activities" ? 5 : 3} maxLength={2000} value={val} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                  ) : (
                    <Input id={f.key} className="mt-1.5" maxLength={300} value={val} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
      <Button variant="navy" onClick={submit}><Save /> Save website settings</Button>
    </div>
  );
}

function UpdatesTab({ initial }: { initial: SiteSettings }) {
  const save = useSave();
  const [list, setList] = useState(initial.updates);
  return (
    <Section title="Latest updates" description="Shown on the home page. Newest first." actions={
      <Button size="sm" variant="outline" onClick={() => setList([{ id: crypto.randomUUID(), title: "", date: new Date().toISOString().slice(0, 10), body: "" }, ...list])}><Plus /> Add update</Button>
    }>
      <div className="space-y-4">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No updates.</p>}
        {list.map((u, i) => (
          <div key={u.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_160px_auto]">
            <Input placeholder="Title" maxLength={120} value={u.title} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input type="date" value={u.date} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Delete update"><Trash2 /></Button>
            <Textarea className="sm:col-span-3" placeholder="Details" maxLength={600} value={u.body} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
          </div>
        ))}
        <Button variant="navy" onClick={() => {
          if (list.some((u) => !u.title.trim())) { toast.error("Every update needs a title"); return; }
          void save({ updates: [...list].sort((a, b) => b.date.localeCompare(a.date)) });
        }}><Save /> Save updates</Button>
      </div>
    </Section>
  );
}

function FormTab({ initial }: { initial: SiteSettings }) {
  const save = useSave();
  const [req, setReq] = useState<Set<ConfigurableField>>(new Set(initial.required_fields));
  const fields = Object.keys(CONFIGURABLE_FIELD_LABELS) as ConfigurableField[];
  return (
    <Section title="Required fields" description="Member ID and full name are always required. Choose which other fields must be filled in.">
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
            {CONFIGURABLE_FIELD_LABELS[f]}
            <Switch checked={req.has(f)} onCheckedChange={(c) => {
              const next = new Set(req);
              if (c) next.add(f); else next.delete(f);
              setReq(next);
            }} />
          </label>
        ))}
      </div>
      <Button className="mt-5" variant="navy" onClick={() => void save({ required_fields: [...req] })}><Save /> Save form rules</Button>
    </Section>
  );
}

function FeeAmountsTab({ initial }: { initial: SiteSettings }) {
  const save = useSave();
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(FEE_TYPES.map((t) => [t, initial.fee_defaults?.[t] ? String(initial.fee_defaults[t]) : ""])),
  );
  function submit() {
    const out: Partial<Record<FeeType, number>> = {};
    for (const t of FEE_TYPES) {
      const raw = v[t] ?? "";
      if (!raw) continue;
      const n = parseAmount(raw);
      if (n === null) { toast.error(`${t}: enter a valid amount`); return; }
      out[t] = n;
    }
    void save({ fee_defaults: out });
  }
  return (
    <Section title="Standard fee amounts (₹)" description="These fill in the amount automatically when you record a payment. You can still change it per payment. Leave blank for no default.">
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        {FEE_TYPES.map((t) => (
          <div key={t}>
            <Label htmlFor={`fee-${t}`}>{t === "Registration" ? "Joining (registration) fee" : t === "Annual" ? "Yearly membership fee" : t}</Label>
            <Input id={`fee-${t}`} inputMode="numeric" className="mt-1.5" value={v[t] ?? ""} onChange={(e) => setV({ ...v, [t]: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
        ))}
      </div>
      <Button className="mt-5" variant="navy" onClick={submit}><Save /> Save fee amounts</Button>
    </Section>
  );
}

function AccountTab() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function change() {
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) { toast.error("New password: at least 10 characters with a letter and a number"); return; }
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await db.auth.changePassword(cur, next);
      toast.success("Password changed");
      setCur(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Change password" description="Use a strong password you don't use anywhere else.">
      <div className="grid max-w-md gap-4">
        <div><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" autoComplete="current-password" className="mt-1.5" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div><Label htmlFor="new">New password</Label><Input id="new" type="password" autoComplete="new-password" className="mt-1.5" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div><Label htmlFor="cnf">Confirm new password</Label><Input id="cnf" type="password" autoComplete="new-password" className="mt-1.5" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <Button variant="navy" onClick={() => void change()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Change password</Button>
      </div>
    </Section>
  );
}

function DataTab() {
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function backup() {
    setBusy(true);
    try {
      const data = await db.maintenance.exportBackup();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `htwma-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await db.maintenance.restoreBackup(JSON.parse(await file.text()));
      await invalidate(["members"], ["committee"], ["gallery"], qk.settings, ["file"], qk.fees);
      toast.success("Backup restored");
      navigate({ to: "/admin" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Backup & restore" description={db.kind === "local"
        ? "Your data is stored only in this browser. Download a backup regularly and keep it somewhere safe — it includes ID numbers and photos."
        : "Download a copy of the records. Full database backups are managed in your Supabase dashboard."}>
        <div className="flex flex-wrap gap-2">
          <Button variant="navy" onClick={() => void backup()} disabled={busy}><Download /> Download backup</Button>
          {db.kind === "local" && (
            <ConfirmDialog
              trigger={<Button variant="outline" disabled={busy}><Upload /> Restore from backup</Button>}
              title="Restore from a backup file?"
              description={<p>All current records in this browser will be replaced by the backup's contents.</p>}
              confirmLabel="Choose file"
              onConfirm={() => fileRef.current?.click()}
            />
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} />
      </Section>
      <Section title="Demo data" description="Remove the fake 'Demo Member' records, their demo fee payments and placeholder gallery photos.">
        <ConfirmDialog
          trigger={<Button variant="outline" className="text-destructive"><Database /> Remove demo data</Button>}
          title="Remove all demo data?"
          description={<p>Deletes records marked as demo and the placeholder photos. Real records are kept.</p>}
          confirmLabel="Remove demo data"
          onConfirm={async () => {
            const n = await db.maintenance.clearDemoData();
            await invalidate(["members"], ["committee"], ["gallery"], qk.fees);
            toast.success(`Removed ${n} demo item(s)`);
          }}
        />
      </Section>
    </div>
  );
}

function LogTab() {
  const { data, isLoading, refetch } = useQuery({ queryKey: qk.audit, queryFn: () => db.audit.list(1000) });
  useEffect(() => { void refetch(); }, [refetch]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState<RangeState>(ALL_TIME);
  if (isLoading) return <LoadingBlock />;
  const r = resolveRange(range);
  const kinds = [...new Set((data ?? []).map((l) => l.entity_type))].sort();
  const shown = (data ?? []).filter((l) => {
    if (kind !== "all" && l.entity_type !== kind) return false;
    if (!inRange(l.created_at, r)) return false;
    const t = q.trim().toLowerCase();
    return !t || l.summary.toLowerCase().includes(t) || l.admin_email.toLowerCase().includes(t);
  });
  return (
    <Section title="Activity log" description="Who changed what. ID numbers are never written to this log.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search activity…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-44" aria-label="Activity type filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {kinds.map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="When" />
      </div>
      <ul className="divide-y text-sm">
        {shown.map((l) => (
          <li key={l.id} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:w-44"><History className="size-3.5" />{new Date(l.created_at).toLocaleString("en-IN")}</span>
            <span className="flex-1">{l.summary}</span>
            <span className="text-xs text-muted-foreground">{l.admin_email}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-center text-muted-foreground">No matching activity.</li>}
      </ul>
    </Section>
  );
}
