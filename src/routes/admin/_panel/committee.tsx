import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Award, Check, ChevronsUpDown, Phone, EyeOff, Search } from "lucide-react";
import { PageHeader, LoadingBlock, Section, EmptyState } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageInput, commitImage, emptyImage, type ImageValue } from "@/components/admin/ImageInput";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/data";
import { qk, useAssignments, useInvalidate, useMembers, useRoles } from "@/lib/data/hooks";
import type { CommitteeAssignment, CommitteeRole } from "@/lib/data/types";
import { formatDate, isValidIndianMobile, normalizePhone } from "@/lib/members";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_panel/committee")({
  head: () => ({ meta: [{ title: "Committee – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: CommitteeAdmin,
});

type Draft = {
  id: string | null;
  member_id: string;
  role_id: string;
  term_start: string;
  term_end: string;
  public_phone: string;
  show_phone: boolean;
  display_order: number;
  is_active: boolean;
  photo: ImageValue;
};

function CommitteeAdmin() {
  const roles = useRoles();
  const assignments = useAssignments();
  const members = useMembers();
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [roleDraft, setRoleDraft] = useState<(Omit<CommitteeRole, "id"> & { id: string | null }) | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const filtersOn = !!q || roleFilter !== "all" || activeFilter !== "all";

  const memberMap = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const refresh = () => invalidate(qk.roles, qk.assignments, qk.publicCommittee);

  if (roles.isLoading || assignments.isLoading || members.isLoading) return <LoadingBlock />;

  function openNew(roleId: string) {
    const count = (assignments.data ?? []).filter((a) => a.role_id === roleId).length;
    setDraft({ id: null, member_id: "", role_id: roleId, term_start: "", term_end: "", public_phone: "", show_phone: false, display_order: count + 1, is_active: true, photo: emptyImage() });
  }
  function openEdit(a: CommitteeAssignment) {
    setDraft({ ...a, term_start: a.term_start ?? "", term_end: a.term_end ?? "", photo: emptyImage(a.public_photo_path) });
  }

  async function save() {
    if (!draft) return;
    if (!draft.member_id) { toast.error("Choose a member"); return; }
    if (draft.public_phone && !isValidIndianMobile(draft.public_phone)) { toast.error("Enter a valid 10-digit phone"); return; }
    if (draft.term_start && draft.term_end && draft.term_end < draft.term_start) { toast.error("Term end must be after term start"); return; }
    setSaving(true);
    try {
      const public_photo_path = await commitImage(draft.photo, "public-media", db.files.upload, db.files.remove);
      await db.committee.saveAssignment({
        id: draft.id,
        member_id: draft.member_id,
        role_id: draft.role_id,
        term_start: draft.term_start || null,
        term_end: draft.term_end || null,
        public_phone: draft.public_phone ? normalizePhone(draft.public_phone) : "",
        show_phone: draft.show_phone,
        public_photo_path,
        display_order: draft.display_order,
        is_active: draft.is_active,
      });
      await refresh();
      toast.success("Committee updated — public page refreshed");
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveRole() {
    if (!roleDraft || !roleDraft.role_name.trim()) { toast.error("Enter a role name"); return; }
    try {
      await db.committee.saveRole({ ...roleDraft, role_name: roleDraft.role_name.trim() });
      await refresh();
      setRoleDraft(null);
      toast.success("Role saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save role");
    }
  }

  const chosen = draft?.member_id ? memberMap.get(draft.member_id) : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Committee"
        description="Assign existing members to committee roles. Only name, role, approved phone and public photo appear on the website."
        actions={<Button variant="outline" onClick={() => setRoleDraft({ id: null, role_name: "", display_order: (roles.data?.length ?? 0) + 1, is_multiple_allowed: false })}><Plus /> Add role</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search committee member…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search committee" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52" aria-label="Role filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.role_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-40" aria-label="Active filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Active & inactive</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        {filtersOn && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setRoleFilter("all"); setActiveFilter("all"); }}>Clear filters</Button>}
      </div>

      <div className="space-y-5">
        {(roles.data ?? []).filter((role) => roleFilter === "all" || role.id === roleFilter).map((role) => {
          const term = q.trim().toLowerCase();
          const list = (assignments.data ?? []).filter((a) => {
            if (a.role_id !== role.id) return false;
            if (activeFilter === "active" && !a.is_active) return false;
            if (activeFilter === "inactive" && a.is_active) return false;
            return !term || (memberMap.get(a.member_id)?.full_name.toLowerCase().includes(term) ?? false);
          });
          if (filtersOn && list.length === 0) return null;
          return (
            <Section key={role.id} title={role.role_name} description={role.is_multiple_allowed ? "Multiple people allowed" : "One active person"} actions={<>
                <Button size="sm" variant="ghost" onClick={() => setRoleDraft(role)} aria-label="Edit role"><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete role"><Trash2 /></Button>}
                  title={`Delete role "${role.role_name}"?`}
                  description={<p>The role must have no assigned people.</p>}
                  confirmLabel="Delete role"
                  onConfirm={async () => {
                    try { await db.committee.deleteRole(role.id); await refresh(); toast.success("Role deleted"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                />
                {(role.is_multiple_allowed || !list.some((a) => a.is_active)) && (
                  <Button size="sm" variant="navy" onClick={() => openNew(role.id)}><Plus /> Assign</Button>
                )}
              </>}>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one assigned yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => {
                    const m = memberMap.get(a.member_id);
                    return (
                      <div key={a.id} className={cn("flex items-center gap-3 rounded-xl border p-3", !a.is_active && "opacity-60")}>
                        <StorageImage bucket="public-media" path={a.public_photo_path} alt={m?.full_name ?? ""} fallbackName={m?.full_name ?? "?"} className="size-12 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-navy">{m?.full_name ?? "Unknown member"}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {a.show_phone && a.public_phone ? <><Phone className="size-3" /> {a.public_phone}</> : <><EyeOff className="size-3" /> Phone hidden</>}
                          </p>
                          {(a.term_start || a.term_end) && <p className="text-xs text-muted-foreground">{formatDate(a.term_start)} – {formatDate(a.term_end)}</p>}
                          {!a.is_active && <Badge variant="outline" className="mt-1">Inactive</Badge>}
                        </div>
                        <div className="flex flex-col">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)} aria-label="Edit"><Pencil /></Button>
                          <ConfirmDialog
                            trigger={<Button size="icon" variant="ghost" className="text-destructive" aria-label="Remove"><Trash2 /></Button>}
                            title="Remove from committee?"
                            description={<p>The member record itself is kept.</p>}
                            confirmLabel="Remove"
                            onConfirm={async () => { await db.committee.deleteAssignment(a.id); await refresh(); toast.success("Removed"); }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          );
        })}
        {(roles.data ?? []).length === 0 && <EmptyState icon={<Award className="size-6" />} title="No roles" text="Add committee roles to get started." />}
      </div>

      {/* Assignment dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit committee member" : "Assign committee member"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={draft.role_id} onValueChange={(v) => setDraft({ ...draft, role_id: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.role_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Member</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="mt-1.5 w-full justify-between font-normal">
                      {chosen ? `#${chosen.member_number} · ${chosen.full_name}` : "Search members…"}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Name or member ID…" />
                      <CommandList>
                        <CommandEmpty>No member found.</CommandEmpty>
                        <CommandGroup>
                          {(members.data ?? []).filter((m) => m.status !== "archived").map((m) => (
                            <CommandItem key={m.id} value={`${m.member_number} ${m.full_name}`} onSelect={() => {
                              setDraft({ ...draft, member_id: m.id, public_phone: draft.public_phone || m.mobile });
                              setPickerOpen(false);
                            }}>
                              <Check className={cn("size-4", draft.member_id === m.id ? "opacity-100" : "opacity-0")} />
                              #{m.member_number} · {m.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="ts">Term start</Label><Input id="ts" type="date" className="mt-1.5" value={draft.term_start} onChange={(e) => setDraft({ ...draft, term_start: e.target.value })} /></div>
                <div><Label htmlFor="te">Term end</Label><Input id="te" type="date" className="mt-1.5" value={draft.term_end} onChange={(e) => setDraft({ ...draft, term_end: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div><Label htmlFor="pp">Contact number</Label><Input id="pp" inputMode="tel" className="mt-1.5" value={draft.public_phone} onChange={(e) => setDraft({ ...draft, public_phone: e.target.value })} /></div>
                <div><Label htmlFor="do">Order</Label><Input id="do" type="number" min={1} className="mt-1.5 w-20" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) || 1 })} /></div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>Show contact number on public website<br /><span className="text-xs text-muted-foreground">Only turn on with this person's approval.</span></span>
                <Switch checked={draft.show_phone} onCheckedChange={(c) => setDraft({ ...draft, show_phone: c })} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>Active (shown on website)</span>
                <Switch checked={draft.is_active} onCheckedChange={(c) => setDraft({ ...draft, is_active: c })} />
              </label>
              <ImageInput label="Public photo (optional)" bucket="public-media" value={draft.photo} onChange={(p) => setDraft({ ...draft, photo: p })} hint="Shown on the public Committee page. Use only with consent." />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="navy" onClick={() => void save()} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role dialog */}
      <Dialog open={!!roleDraft} onOpenChange={(o) => !o && setRoleDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{roleDraft?.id ? "Edit role" : "Add role"}</DialogTitle></DialogHeader>
          {roleDraft && (
            <div className="space-y-4">
              <div><Label htmlFor="rn">Role name</Label><Input id="rn" className="mt-1.5" maxLength={60} value={roleDraft.role_name} onChange={(e) => setRoleDraft({ ...roleDraft, role_name: e.target.value })} /></div>
              <div><Label htmlFor="ro">Display order</Label><Input id="ro" type="number" min={1} className="mt-1.5 w-24" value={roleDraft.display_order} onChange={(e) => setRoleDraft({ ...roleDraft, display_order: Number(e.target.value) || 1 })} /></div>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                Allow multiple people in this role
                <Switch checked={roleDraft.is_multiple_allowed} onCheckedChange={(c) => setRoleDraft({ ...roleDraft, is_multiple_allowed: c })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDraft(null)}>Cancel</Button>
            <Button variant="navy" onClick={() => void saveRole()}>Save role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
