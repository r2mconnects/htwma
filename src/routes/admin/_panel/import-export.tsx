import { createFileRoute, Link } from "@tanstack/react-router";
import { ALL_TIME, DateRangeFilter, resolveRange, type RangeState } from "@/components/admin/DateRangeFilter";
import { inRange } from "@/lib/fees";
import { BLOOD_GROUPS } from "@/lib/members";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, ShieldAlert, Loader2, RotateCcw } from "lucide-react";
import { PageHeader, Section } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/data";
import { qk, useInvalidate, useMembers } from "@/lib/data/hooks";
import {
  MEMBER_COLUMNS,
  SAFE_EXPORT_DEFAULT,
  downloadSheet,
  guessMapping,
  memberToExportRow,
  parseSpreadsheet,
  validateImportRows,
  type ImportRowResult,
  type MemberColumnKey,
} from "@/lib/import-export";

export const Route = createFileRoute("/admin/_panel/import-export")({
  head: () => ({ meta: [{ title: "Import / Export – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: ImportExport,
});

function ImportExport() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Import / Export" description="Bring in member lists from Excel or CSV, or download records." />
      <ExportPanel />
      <ImportPanel />
      <Section title="Fee payments" description="Fee reports (with date, fee type and payment mode filters) are exported from the Fees page.">
        <Button asChild variant="outline"><Link to="/admin/fees"><Download /> Go to Fees export</Link></Button>
      </Section>
    </div>
  );
}

function ExportPanel() {
  const { data } = useMembers();
  const [scope, setScope] = useState<"current" | "active" | "archived" | "all">("current");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [cols, setCols] = useState<Set<MemberColumnKey>>(new Set(SAFE_EXPORT_DEFAULT));
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [blood, setBlood] = useState("all");
  const [regRange, setRegRange] = useState<RangeState>(ALL_TIME);
  const hasSensitive = [...cols].some((c) => MEMBER_COLUMNS.find((x) => x.key === c)?.sensitive);

  const reg = resolveRange(regRange);
  const term = q.trim().toLowerCase();
  const list = (data ?? []).filter((m) =>
    (scope === "all" ? true : scope === "current" ? m.status !== "archived" : scope === "active" ? m.status === "active" : m.status === "archived") &&
    (blood === "all" || m.blood_group === blood) &&
    inRange(m.registration_date, reg) &&
    (!term || m.full_name.toLowerCase().includes(term) || m.garage_name.toLowerCase().includes(term) || m.address.toLowerCase().includes(term)),
  );

  async function run(verified: boolean) {
    if (hasSensitive && !verified) {
      setAskPassword(true);
      return;
    }
    setBusy(true);
    try {
      const order = MEMBER_COLUMNS.map((c) => c.key).filter((k) => cols.has(k));
      const sens = hasSensitive ? await db.members.getSensitiveMany(list.map((m) => m.id)) : {};
      const rows = list.map((m) => memberToExportRow(m, order, sens[m.id]));
      await downloadSheet(rows, `htwma-members-${new Date().toISOString().slice(0, 10)}`, format);
      await db.audit.log("export", "member", "-", `Exported ${rows.length} members (${format.toUpperCase()}${hasSensitive ? ", INCLUDING ID numbers" : ""})`);
      toast.success(`Exported ${rows.length} members`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPassword() {
    if (!(await db.auth.verifyPassword(password))) {
      toast.error("Incorrect password");
      return;
    }
    setAskPassword(false);
    setPassword("");
    await run(true);
  }

  return (
    <Section title="Export members" description="By default, government ID numbers are never included.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[200px_160px_1fr]">
        <div>
          <Label>Which members</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Active & inactive</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="archived">Archived only</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Blood group</Label>
          <Select value={blood} onValueChange={setBlood}>
            <SelectTrigger className="mt-1.5 sm:w-40" aria-label="Export blood group filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="exp-q">Name, garage or area contains</Label>
          <Input id="exp-q" className="mt-1.5" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Parigi Road" />
        </div>
        <DateRangeFilter value={regRange} onChange={setRegRange} label="Registered" />
      </div>
      <p className="mb-2 mt-5 text-sm font-medium">Columns</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MEMBER_COLUMNS.map((c) => (
          <label key={c.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${c.sensitive ? "border-warning/50 bg-warning/5" : ""}`}>
            <Checkbox checked={cols.has(c.key)} onCheckedChange={(v) => {
              const next = new Set(cols);
              if (v) next.add(c.key); else next.delete(c.key);
              setCols(next);
            }} />
            {c.label}
            {c.sensitive && <ShieldAlert className="ml-auto size-4 text-warning" />}
          </label>
        ))}
      </div>
      {hasSensitive && (
        <p className="mt-3 flex items-start gap-2 text-sm text-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" /> You selected ID number columns. You'll be asked to re-enter your admin password, and the export is recorded.
        </p>
      )}
      <Button className="mt-5" variant="navy" disabled={busy || cols.size === 0 || list.length === 0} onClick={() => void run(false)}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Export {list.length} members
      </Button>

      <Dialog open={askPassword} onOpenChange={setAskPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm sensitive export</DialogTitle>
            <DialogDescription>This file will contain Aadhaar, PAN or licence numbers. Store it securely and delete it when done.</DialogDescription>
          </DialogHeader>
          <div><Label htmlFor="pw">Admin password</Label><Input id="pw" type="password" className="mt-1.5" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskPassword(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmPassword()}>Export with ID numbers</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

type Step = "upload" | "map" | "preview" | "done";

function ImportPanel() {
  const { data: members } = useMembers();
  const invalidate = useInvalidate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<MemberColumnKey, number>>>({});
  const [summary, setSummary] = useState<{ added: number; skipped: number; invalid: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const results: ImportRowResult[] = useMemo(
    () => (step === "preview" || step === "done" ? validateImportRows(rows, mapping, (members ?? []).map((m) => m.member_number)) : []),
    [step, rows, mapping, members],
  );
  const valid = results.filter((r) => r.input && !r.duplicate);
  const dupes = results.filter((r) => r.duplicate);
  const invalid = results.filter((r) => r.errors.length);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { toast.error("Choose a .csv or .xlsx file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File is larger than 5 MB"); return; }
    try {
      const parsed = await parseSpreadsheet(file);
      if (!parsed.rows.length) { toast.error("No data rows found"); return; }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(guessMapping(parsed.headers));
      setStep("map");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    setBusy(true);
    try {
      const added = await db.members.bulkCreate(valid.map((r) => r.input!));
      await invalidate(qk.members);
      setSummary({ added, skipped: dupes.length, invalid: invalid.length });
      setStep("done");
      toast.success(`Imported ${added} members`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    const row: Record<string, string> = {};
    MEMBER_COLUMNS.filter((c) => c.importable).forEach((c) => (row[c.label] = ""));
    await downloadSheet([row], "htwma-import-template", "xlsx");
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setHeaders([]);
    setSummary(null);
  }

  const importable = MEMBER_COLUMNS.filter((c) => c.importable);

  return (
    <Section
      title="Import members"
      description="Upload → match columns → check preview → confirm. Invalid rows are listed, never silently skipped."
      actions={<Button variant="outline" size="sm" onClick={() => void downloadTemplate()}><FileSpreadsheet /> Template</Button>}
    >
      <ol className="mb-5 flex flex-wrap gap-2 text-xs">
        {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 font-medium ${step === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {i + 1}. {s === "upload" ? "Upload" : s === "map" ? "Match columns" : s === "preview" ? "Preview" : "Summary"}
          </li>
        ))}
      </ol>

      {step === "upload" && (
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition hover:border-primary hover:bg-secondary/50">
          <Upload className="size-10 text-primary" />
          <p className="mt-3 font-semibold text-navy">Choose an Excel (.xlsx) or CSV file</p>
          <p className="mt-1 text-sm text-muted-foreground">First row must be column headings. Max 5 MB.</p>
        </button>
      )}
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {step === "map" && (
        <div>
          <p className="mb-4 text-sm"><span className="font-semibold">{fileName}</span> · {rows.length} rows. Check each field matches the right column.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {importable.map((c) => (
              <div key={c.key}>
                <Label className="flex items-center gap-1">
                  {c.label} {(c.key === "member_number" || c.key === "full_name") && <span className="text-destructive">*</span>}
                  {c.sensitive && <ShieldAlert className="size-3.5 text-warning" />}
                </Label>
                <Select value={mapping[c.key] === undefined ? "none" : String(mapping[c.key])} onValueChange={(v) => {
                  const next = { ...mapping };
                  if (v === "none") delete next[c.key]; else next[c.key] = Number(v);
                  setMapping(next);
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not in file —</SelectItem>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={reset}>Back</Button>
            <Button variant="navy" disabled={mapping.member_number === undefined || mapping.full_name === undefined} onClick={() => setStep("preview")}>Preview import</Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-success/10 p-4"><p className="text-2xl font-bold text-success">{valid.length}</p><p className="text-sm">Ready to import</p></div>
            <div className="rounded-xl bg-warning/10 p-4"><p className="text-2xl font-bold text-warning">{dupes.length}</p><p className="text-sm">Duplicate Member IDs (skipped)</p></div>
            <div className="rounded-xl bg-destructive/10 p-4"><p className="text-2xl font-bold text-destructive">{invalid.length}</p><p className="text-sm">Rows with errors (skipped)</p></div>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow><TableHead>Row</TableHead><TableHead>Member ID</TableHead><TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Result</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const get = (k: MemberColumnKey) => (mapping[k] === undefined ? "" : rows[r.rowNumber - 2]?.[mapping[k]!] ?? "");
                  return (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-mono">{get("member_number")}</TableCell>
                      <TableCell>{get("full_name")}</TableCell>
                      <TableCell>{get("mobile")}</TableCell>
                      <TableCell>
                        {r.errors.length ? (
                          <span className="flex items-start gap-1 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{r.errors.join("; ")}</span>
                        ) : r.duplicate ? (
                          <Badge variant="outline" className="border-warning/50 text-warning">{r.duplicate === "existing" ? "ID already exists" : "Repeated in file"}</Badge>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="size-4" /> OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
            <Button variant="navy" disabled={!valid.length || busy} onClick={() => void confirmImport()}>
              {busy && <Loader2 className="animate-spin" />} Import {valid.length} members
            </Button>
          </div>
        </div>
      )}

      {step === "done" && summary && (
        <div className="rounded-2xl bg-secondary p-6">
          <CheckCircle2 className="size-10 text-success" />
          <h3 className="mt-3 font-display text-xl font-bold text-navy">Import complete</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>✓ {summary.added} members added</li>
            <li>• {summary.skipped} duplicates skipped</li>
            <li>• {summary.invalid} rows with errors skipped — fix them in your file and import again</li>
          </ul>
          <Button className="mt-4" variant="outline" onClick={reset}><RotateCcw /> Import another file</Button>
        </div>
      )}
    </Section>
  );
}
