import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useInvalidate, useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import {
  FEE_TYPES,
  type ConfigurableField,
  type FeeType,
  type SiteSettings,
} from "@/lib/data/types";
import { CONFIGURABLE_FIELD_LABELS } from "@/components/admin/MemberForm";
import {
  ImageInput,
  emptyImage,
  finalizeStagedUploads,
  rollbackStagedUploads,
  stageImageUpload,
  type ImageValue,
  type StagedUpload,
} from "@/components/admin/ImageInput";
import { PageHeader, Section } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/_panel/settings")({
  head: () => ({ meta: [{ title: "Settings — HTWMA Admin" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useSettings();
  const invalidate = useInvalidate();
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [logo, setLogo] = useState<ImageValue>(emptyImage(null));
  const [savingSettings, setSavingSettings] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const session = useQuery({ queryKey: ["auth", "session"], queryFn: () => db.auth.getSession() });
  const admins = useQuery({ queryKey: qk.admins, queryFn: () => db.auth.listAdmins() });

  useEffect(() => {
    if (settings.data) {
      setForm(settings.data);
      setLogo(emptyImage(settings.data.logo_path));
    }
  }, [settings.data]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    const staged: StagedUpload[] = [];
    try {
      const stagedLogo = await stageImageUpload(
        logo,
        "public-media",
        db.files.upload,
        "association-logo.jpg",
      );
      staged.push(stagedLogo);
      const updated = await db.content.updateSettings({
        ...form,
        logo_path: stagedLogo.nextPath,
      });
      await finalizeStagedUploads(staged, db.files.remove);
      setForm(updated);
      setLogo(emptyImage(updated.logo_path));
      await invalidate(qk.settings, qk.audit);
      toast.success("Website settings saved to Supabase");
    } catch (err) {
      await rollbackStagedUploads(staged, db.files.remove);
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function toggleRequired(field: ConfigurableField, checked: boolean) {
    setForm((f) => ({
      ...f,
      required_fields: checked
        ? [...f.required_fields, field]
        : f.required_fields.filter((x) => x !== field),
    }));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await db.auth.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      await invalidate(qk.audit);
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    }
  }

  async function clearDemo() {
    if (!confirm("Remove all sample/demo records? Real association records are preserved.")) return;
    const removed = await db.maintenance.clearDemoData();
    await invalidate(
      qk.members,
      qk.assignments,
      qk.publicCommittee,
      qk.gallery,
      qk.publishedGallery,
      qk.fees,
      qk.audit,
    );
    toast.success(`Removed ${removed} sample item(s)`);
  }

  const field = (key: keyof SiteSettings, label: string, multiline = false) => (
    <div key={key}>
      <Label htmlFor={key}>{label}</Label>
      {multiline ? (
        <Textarea
          id={key}
          rows={3}
          className="mt-1.5"
          value={String(form[key] ?? "")}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <Input
          id={key}
          className="mt-1.5"
          value={String(form[key] ?? "")}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Association branding, public website copy, registration rules and administrator security."
      />

      <form onSubmit={saveSettings} className="space-y-6">
        <Section title="Association branding & identity">
          <div className="mb-5">
            <ImageInput
              label="Official association logo (optional)"
              bucket="public-media"
              value={logo}
              onChange={setLogo}
              maxSize={512}
              hint="Shown in the website header, footer, receipts and printable registration forms. Leave blank to use the default HTWMA emblem."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("association_name", "Full association name")}
            {field("short_name", "Short name")}
            {field("tagline", "Tagline")}
            {field("location_label", "Location badge")}
            {field("form_code", "Registration form header code")}
          </div>
        </Section>

        <Section title="Contact & social links">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("address", "Office address", true)}</div>
            {field("phone", "Phone number")}
            {field("whatsapp", "WhatsApp number")}
            {field("email", "Email")}
            {field("office_hours", "Office timings")}
            {field("map_url", "Google Maps link")}
            {field("facebook_url", "Facebook link")}
            {field("youtube_url", "YouTube link")}
            {field("x_url", "X / Twitter link")}
          </div>
        </Section>

        <Section title="Public page copy">
          <div className="space-y-4">
            {field("home_intro", "Home page introduction", true)}
            {field("about_intro", "About page subtitle", true)}
            {field("history", "Association background", true)}
            {field("mission", "Mission", true)}
            {field("vision", "Vision", true)}
            {field("activities", "What we do (one bullet per line)", true)}
          </div>
        </Section>

        <Section
          title="Registration form — required fields"
          description="Member ID and Full Name are always required. Tick any other fields your office wants to make compulsory."
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(CONFIGURABLE_FIELD_LABELS) as ConfigurableField[]).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                <Checkbox
                  checked={form.required_fields.includes(k)}
                  onCheckedChange={(c) => toggleRequired(k, c === true)}
                />
                {CONFIGURABLE_FIELD_LABELS[k]}
              </label>
            ))}
          </div>
        </Section>

        <Section
          title="Default fee amounts (₹)"
          description="Pre-fills the amount when recording a payment. Leave blank if the amount varies."
        >
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {FEE_TYPES.map((t: FeeType) => (
              <div key={t}>
                <Label htmlFor={`fee-${t}`}>{t}</Label>
                <Input
                  id={`fee-${t}`}
                  inputMode="numeric"
                  placeholder="—"
                  className="mt-1.5"
                  value={form.fee_defaults[t] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    const next = { ...form.fee_defaults };
                    if (raw) next[t] = Number(raw);
                    else delete next[t];
                    setForm({ ...form, fee_defaults: next });
                  }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Button type="submit" variant="navy" size="lg" disabled={savingSettings}>
          <Save /> Save website settings
        </Button>
      </form>

      <Section
        title="Admin account & password"
        description={`Signed in via Supabase Auth as ${session.data?.email ?? "—"} (${session.data?.role ?? "admin"})`}
      >
        <form onSubmit={changePassword} className="grid max-w-md gap-3">
          <div>
            <Label htmlFor="pw-cur">Current password</Label>
            <Input
              id="pw-cur"
              type="password"
              className="mt-1.5"
              required
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pw-next">New password (min 8 characters)</Label>
            <Input
              id="pw-next"
              type="password"
              className="mt-1.5"
              required
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pw-con">Confirm new password</Label>
            <Input
              id="pw-con"
              type="password"
              className="mt-1.5"
              required
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            />
          </div>
          <Button type="submit" variant="outline" className="w-fit">
            <KeyRound /> Change password
          </Button>
        </form>

        {(admins.data ?? []).length > 0 && (
          <div className="mt-6 border-t pt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy">
              <ShieldCheck className="size-4 text-brand" /> Authorised Administrators
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted font-semibold">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(admins.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="p-2.5 font-medium">{a.display_name || "Admin"}</td>
                      <td className="p-2.5">{a.email}</td>
                      <td className="p-2.5 uppercase">{a.role}</td>
                      <td className="p-2.5">
                        <span
                          className={
                            a.is_active ? "font-semibold text-success" : "text-muted-foreground"
                          }
                        >
                          {a.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Sample data cleanup"
        description="Remove any records explicitly flagged as sample/demo data without affecting real association records."
      >
        <Button type="button" variant="outline" onClick={() => void clearDemo()}>
          <Trash2 /> Remove sample/demo records
        </Button>
      </Section>
    </div>
  );
}
