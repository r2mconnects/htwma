import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileDown, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useInvalidate, useMembers } from "@/lib/data/hooks";
import type { MemberSensitive, MemberStatus } from "@/lib/data/types";
import { isoDay } from "@/lib/fees";
import {
  MEMBER_COLUMNS,
  SAFE_EXPORT_DEFAULT,
  downloadSheet,
  guessMapping,
  memberToExportRow,
  parseSpreadsheet,
  validateImportRows,
  type MemberColumnKey,
} from "@/lib/import-export";
import { PageHeader, Section } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_panel/import-export")({
  head: () => ({ meta: [{ title: "Import / Export — HTWMA Admin" }] }),
  component: ImportExportPage,
});

function ImportExportPage() {
  const members = useMembers();
  const invalidate = useInvalidate();
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Export state ----
  const [cols, setCols] = useState<MemberColumnKey[]>(SAFE_EXPORT_DEFAULT);
  const [statusFilter, setStatusFilter] = useState<"all" | MemberStatus>("active");
  const [pendingFormat, setPendingFormat] = useState<"csv" | "xlsx" | null>(null);
  const [password, setPassword] = useState("");

  const includesSensitive = cols.some((k) => MEMBER_COLUMNS.find((c) => c.key === k)?.sensitive);

  function toggleCol(k: MemberColumnKey, checked: boolean) {
    setCols((prev) => (checked ? [...prev, k] : prev.filter((x) => x !== k)));
  }

  async function runExport(format: "csv" | "xlsx") {
    if (cols.length === 0) {
      toast.error("Tick at least one column to export");
      return;
    }
    if (includesSensitive) {
      setPendingFormat(format);
      return;
    }
    await performExport(format, {});
  }

  async function confirmSensitiveExport() {
    if (!pendingFormat) return;
    if (!(await db.auth.verifyPassword(password))) {
      toast.error("Password is incorrect");
      return;
    }
    const list = filteredMembers();
    const sens = await db.members.getSensitiveMany(list.map((m) => m.id));
    await performExport(pendingFormat, sens, true);
    setPassword("");
    setPendingFormat(null);
  }

  function filteredMembers() {
    const all = members.data ?? [];
    return statusFilter === "all" ? all : all.filter((m) => m.status === statusFilter);
  }

  async function performExport(
    format: "csv" | "xlsx",
    sens: Record<string, MemberSensitive>,
    sensitive = false,
  ) {
    const list = filteredMembers();
    if (list.length === 0) {
      toast.error("No members match the chosen filter");
      return;
    }
    const ordered = MEMBER_COLUMNS.map((c) => c.key).filter((k) => cols.includes(k));
    const rows = list.map((m) => memberToExportRow(m, ordered, sens[m.id]));
    const date = isoDay(new Date());
    await downloadSheet(rows, `htwma-members-${date}`, format);
    await db.audit.log(
      sensitive ? "export_sensitive" : "export",
      "member",
      "-",
      `Exported ${list.length} member(s) as ${format.toUpperCase()}${sensitive ? " (included sensitive IDs)" : ""}`,
    );
    await invalidate(qk.audit);
    toast.success(`Exported ${list.length} member(s)`);
  }

  async function downloadTemplate() {
    const headers: Record<string, string> = {};
    for (const c of MEMBER_COLUMNS.filter((x) => x.importable && !x.sensitive))
      headers[c.label] = "";
    headers["Member ID"] = "001";
    headers["Full Name"] = "Example Name";
    headers["Garage Name"] = "Sri Example Auto Works";
    headers["Mobile / WhatsApp"] = "9876543210";
    headers["Blood Group"] = "O+";
    headers["Date of Birth"] = "15/08/1985";
    await downloadSheet([headers], "htwma-import-template", "xlsx");
  }

  // ---- Import state ----
  const [sheet, setSheet] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(
    null,
  );
  const [mapping, setMapping] = useState<Partial<Record<MemberColumnKey, number>>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = await parseSpreadsheet(f);
      setSheet({ name: f.name, ...parsed });
      setMapping(guessMapping(parsed.headers));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const preview = useMemo(() => {
    if (!sheet) return [];
    const existing = (members.data ?? []).map((m) => m.member_number);
    return validateImportRows(sheet.rows, mapping, existing);
  }, [sheet, mapping, members.data]);

  const validRows = preview.filter((r) => r.input && (!r.duplicate || !skipDuplicates));
  const errorRows = preview.filter((r) => r.errors.length > 0);
  const dupRows = preview.filter((r) => r.duplicate);

  async function commitImport() {
    const toCreate = preview.filter((r) => r.input && !r.duplicate).map((r) => r.input!);
    if (toCreate.length === 0) {
      toast.error("Nothing valid to import");
      return;
    }
    setImporting(true);
    try {
      const count = await db.members.bulkCreate(toCreate);
      await invalidate(qk.members, qk.audit, ["members", "peek-next"]);
      toast.success(`Imported ${count} member(s) into Supabase`);
      setSheet(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // ---- Full JSON backup ----
  async function downloadBackup() {
    const data = await db.maintenance.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `htwma-backup-${isoDay(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await invalidate(qk.audit);
    toast.success("JSON snapshot downloaded (sensitive IDs excluded)");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import & Export"
        subtitle="Bring existing registers in from Excel/CSV, or export member lists cleanly."
      />

      {/* EXPORT */}
      <Section
        title="Export members to Excel or CSV"
        description="Sensitive ID columns are unticked by default and require password confirmation."
      >
        <div className="space-y-4">
          <div className="max-w-xs">
            <Label>Which members</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="archived">Archived only</SelectItem>
                <SelectItem value="all">All members</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Columns to include</p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {MEMBER_COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <Checkbox
                    checked={cols.includes(c.key)}
                    onCheckedChange={(ch) => toggleCol(c.key, ch === true)}
                  />
                  <span>{c.label}</span>
                  {c.sensitive && (
                    <span className="ml-auto rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                      ID
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {includesSensitive && (
            <div className="flex items-center gap-2 rounded-xl bg-warning/15 p-3 text-xs font-medium">
              <ShieldAlert className="size-4 shrink-0 text-warning" />
              You have ticked Aadhaar, PAN or Driving Licence. Handle the downloaded file carefully
              and delete it after use.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="navy" onClick={() => void runExport("xlsx")}>
              <Download /> Download Excel (.xlsx)
            </Button>
            <Button variant="outline" onClick={() => void runExport("csv")}>
              <Download /> Download CSV (.csv)
            </Button>
          </div>
        </div>
      </Section>

      {/* IMPORT */}
      <Section
        title="Import members from Excel or CSV"
        description="Every row is checked first in a preview — nothing is saved until you confirm."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="navy" onClick={() => fileRef.current?.click()}>
            <Upload /> Choose .xlsx or .csv file
          </Button>
          <Button variant="outline" onClick={() => void downloadTemplate()}>
            <FileDown /> Download sample template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>

        {sheet && (
          <div className="mt-6 space-y-5 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                File: <span className="text-navy">{sheet.name}</span> ({sheet.rows.length} rows)
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSheet(null)}>
                Clear
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Match your spreadsheet columns</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MEMBER_COLUMNS.filter((c) => c.importable).map((col) => (
                  <div key={col.key}>
                    <Label className="text-xs">
                      {col.label} {(col.key === "member_number" || col.key === "full_name") && "*"}
                    </Label>
                    <Select
                      value={mapping[col.key] !== undefined ? String(mapping[col.key]) : "none"}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === "none") delete next[col.key];
                          else next[col.key] = Number(v);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not in file —</SelectItem>
                        {sheet.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-muted p-3.5 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                <CheckCircle2 className="size-4" />{" "}
                {preview.filter((r) => r.input && !r.duplicate).length} ready to import
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
                <AlertTriangle className="size-4" /> {dupRows.length} duplicate ID(s)
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
                <AlertTriangle className="size-4" /> {errorRows.length} with errors
              </span>
            </div>

            {(errorRows.length > 0 || dupRows.length > 0) && (
              <div className="max-h-60 overflow-auto rounded-xl border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted font-semibold">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview
                      .filter((r) => r.errors.length || r.duplicate)
                      .map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="p-2.5 font-mono">#{r.rowNumber}</td>
                          <td className="p-2.5">
                            {r.duplicate === "existing" && (
                              <span className="text-warning">
                                Member ID already exists — will be skipped.{" "}
                              </span>
                            )}
                            {r.duplicate === "file" && (
                              <span className="text-warning">
                                Duplicate Member ID inside this file — skipped.{" "}
                              </span>
                            )}
                            {r.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={skipDuplicates}
                onCheckedChange={(c) => setSkipDuplicates(c === true)}
                disabled
              />
              Duplicate Member IDs are skipped automatically so existing records are never
              overwritten.
            </label>

            <Button
              variant="navy"
              onClick={() => void commitImport()}
              disabled={importing || validRows.length === 0}
            >
              Import {preview.filter((r) => r.input && !r.duplicate).length} valid member(s)
            </Button>
          </div>
        )}
      </Section>

      {/* JSON BACKUP */}
      <Section
        title="JSON Snapshot Backup"
        description="Download a portable JSON snapshot of public settings, members, committee, gallery, announcements and fees (sensitive IDs excluded)."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void downloadBackup()}>
            <Download /> Download JSON Snapshot
          </Button>
        </div>
      </Section>

      <Dialog open={!!pendingFormat} onOpenChange={(o) => !o && setPendingFormat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm sensitive export</DialogTitle>
            <DialogDescription>
              Enter your admin password to include Aadhaar, PAN or Driving Licence numbers in this
              file.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="exp-pw">Admin password</Label>
            <Input
              id="exp-pw"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFormat(null)}>
              Cancel
            </Button>
            <Button variant="navy" onClick={() => void confirmSensitiveExport()}>
              Confirm & download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
