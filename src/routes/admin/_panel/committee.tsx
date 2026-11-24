import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Edit, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { qk, useAssignments, useInvalidate, useMembers, useRoles } from "@/lib/data/hooks";
import type { CommitteeAssignment, CommitteeRole } from "@/lib/data/types";
import { PageHeader, Section } from "@/components/admin/common";
import {
  ImageInput,
  emptyImage,
  finalizeStagedUploads,
  rollbackStagedUploads,
  stageImageUpload,
  type ImageValue,
  type StagedUpload,
} from "@/components/admin/ImageInput";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/admin/_panel/committee")({
  head: () => ({ meta: [{ title: "Committee — HTWMA Admin" }] }),
  component: AdminCommitteePage,
});

interface AssignDraft {
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
}

type RoleDraft = Omit<CommitteeRole, "id"> & { id: string | null };

function AdminCommitteePage() {
  const roles = useRoles();
  const assignments = useAssignments();
  const members = useMembers();
  const invalidate = useInvalidate();

  const [assignDraft, setAssignDraft] = useState<AssignDraft | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const activeMembers = (members.data ?? []).filter((m) => m.status === "active");
  const roleList = roles.data ?? [];
  const assignList = assignments.data ?? [];

  function openNewAssign(roleId?: string) {
    const firstMember = activeMembers[0];
    setAssignDraft({
      id: null,
      member_id: firstMember?.id ?? "",
      role_id: roleId ?? roleList[0]?.id ?? "",
      term_start: "",
      term_end: "",
      public_phone: firstMember?.mobile ?? "",
      show_phone: false,
      display_order: assignList.length + 1,
      is_active: true,
      photo: emptyImage(),
    });
  }

  function openEditAssign(a: CommitteeAssignment) {
    setAssignDraft({
      id: a.id,
      member_id: a.member_id,
      role_id: a.role_id,
      term_start: a.term_start ?? "",
      term_end: a.term_end ?? "",
      public_phone: a.public_phone,
      show_phone: a.show_phone,
      display_order: a.display_order,
      is_active: a.is_active,
      photo: emptyImage(a.public_photo_path),
    });
  }

  async function saveAssign() {
    if (!assignDraft) return;
    if (!assignDraft.member_id || !assignDraft.role_id) {
      toast.error("Select both a member and a role");
      return;
    }
    setSaving(true);
    const staged: StagedUpload[] = [];
    try {
      const stagedPhoto = await stageImageUpload(
        assignDraft.photo,
        "public-media",
        db.files.upload,
        "committee.jpg",
      );
      staged.push(stagedPhoto);
      await db.committee.saveAssignment({
        id: assignDraft.id,
        member_id: assignDraft.member_id,
        role_id: assignDraft.role_id,
        term_start: assignDraft.term_start || null,
        term_end: assignDraft.term_end || null,
        public_phone: assignDraft.public_phone,
        show_phone: assignDraft.show_phone,
        public_photo_path: stagedPhoto.nextPath,
        display_order: Number(assignDraft.display_order) || 1,
        is_active: assignDraft.is_active,
      });
      await finalizeStagedUploads(staged, db.files.remove);
      await invalidate(qk.assignments, qk.publicCommittee, qk.audit);
      toast.success("Committee updated");
      setAssignDraft(null);
    } catch (e) {
      await rollbackStagedUploads(staged, db.files.remove);
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssign(a: CommitteeAssignment) {
    if (!confirm("Remove this office-bearer from the committee?")) return;
    await db.committee.deleteAssignment(a.id);
    await invalidate(qk.assignments, qk.publicCommittee, qk.audit);
    toast.success("Removed");
  }

  async function moveAssign(a: CommitteeAssignment, dir: -1 | 1, siblings: CommitteeAssignment[]) {
    const idx = siblings.findIndex((s) => s.id === a.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await db.committee.saveAssignment({ ...a, display_order: swap.display_order });
    await db.committee.saveAssignment({ ...swap, display_order: a.display_order });
    await invalidate(qk.assignments, qk.publicCommittee);
  }

  async function saveRole() {
    if (!roleDraft?.role_name.trim()) {
      toast.error("Role name is required");
      return;
    }
    try {
      await db.committee.saveRole({ ...roleDraft, role_name: roleDraft.role_name.trim() });
      await invalidate(qk.roles, qk.publicCommittee, qk.audit);
      toast.success("Role saved");
      setRoleDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save role");
    }
  }

  async function removeRole(r: CommitteeRole) {
    if (!confirm(`Delete the "${r.role_name}" role?`)) return;
    try {
      await db.committee.deleteRole(r.id);
      await invalidate(qk.roles, qk.publicCommittee, qk.audit);
      toast.success("Role deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete role");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Committee"
        subtitle="Assign active members to leadership roles. Changes appear on the public Committee page immediately."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setRoleDraft({
                  id: null,
                  role_name: "",
                  display_order: roleList.length + 1,
                  is_multiple_allowed: true,
                })
              }
            >
              <Plus /> Add Role
            </Button>
            <Button
              variant="navy"
              onClick={() => openNewAssign()}
              disabled={activeMembers.length === 0}
            >
              <Plus /> Assign Member
            </Button>
          </>
        }
      />

      {activeMembers.length === 0 && (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Add active members first before assigning them to the committee.
        </p>
      )}

      <div className="space-y-5">
        {roleList.map((role) => {
          const inRole = assignList
            .filter((a) => a.role_id === role.id)
            .sort((a, b) => a.display_order - b.display_order);
          const canAddMore =
            role.is_multiple_allowed || inRole.filter((x) => x.is_active).length === 0;
          return (
            <Section
              key={role.id}
              title={role.role_name}
              description={
                role.is_multiple_allowed ? "Multiple members allowed" : "Single office-bearer"
              }
            >
              <div className="space-y-3">
                {inRole.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Vacant</p>
                ) : (
                  inRole.map((a, idx) => {
                    const m = members.data?.find((x) => x.id === a.member_id);
                    return (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <StorageImage
                            bucket="public-media"
                            path={a.public_photo_path}
                            alt={m?.full_name ?? "Member"}
                            className="size-12 rounded-xl"
                            fallback={
                              <div className="grid size-12 place-items-center rounded-xl bg-accent font-bold text-navy">
                                {m?.full_name.charAt(0) ?? "?"}
                              </div>
                            }
                          />
                          <div>
                            <p className="font-semibold">
                              {m?.full_name ?? "Unknown member"}{" "}
                              {!a.is_active && (
                                <span className="text-xs text-muted-foreground">(past term)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m?.garage_name || `Member #${m?.member_number ?? ""}`}
                              {a.show_phone && a.public_phone
                                ? ` · Public phone: ${a.public_phone}`
                                : " · Phone hidden"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {inRole.length > 1 && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={idx === 0}
                                onClick={() => void moveAssign(a, -1, inRole)}
                                aria-label="Move up"
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={idx === inRole.length - 1}
                                onClick={() => void moveAssign(a, 1, inRole)}
                                aria-label="Move down"
                              >
                                <ArrowDown />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditAssign(a)}
                            aria-label="Edit"
                          >
                            <Edit />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => void removeAssign(a)}
                            aria-label="Remove"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="flex flex-wrap justify-between gap-2 pt-1">
                  {canAddMore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openNewAssign(role.id)}
                      disabled={activeMembers.length === 0}
                    >
                      <Plus /> Assign to {role.role_name}
                    </Button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRoleDraft(role)}>
                      Edit role
                    </Button>
                    {inRole.length === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void removeRole(role)}
                      >
                        Delete role
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Section>
          );
        })}
      </div>

      {/* Assignment dialog */}
      <Dialog open={!!assignDraft} onOpenChange={(o) => !o && setAssignDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {assignDraft?.id ? "Edit committee member" : "Assign member to committee"}
            </DialogTitle>
            <DialogDescription>
              Only details ticked for public display appear on the website.
            </DialogDescription>
          </DialogHeader>
          {assignDraft && (
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select
                  value={assignDraft.role_id}
                  onValueChange={(v) => setAssignDraft({ ...assignDraft, role_id: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleList.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Member</Label>
                <Select
                  value={assignDraft.member_id}
                  onValueChange={(v) => {
                    const m = activeMembers.find((x) => x.id === v);
                    setAssignDraft({
                      ...assignDraft,
                      member_id: v,
                      public_phone: assignDraft.public_phone || m?.mobile || "",
                    });
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        #{m.member_number} — {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ImageInput
                label="Public portrait (optional)"
                bucket="public-media"
                value={assignDraft.photo}
                onChange={(photo) => setAssignDraft({ ...assignDraft, photo })}
                hint="Shown on the public Committee page. Leave blank to show initials."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Public phone</Label>
                  <Input
                    className="mt-1.5"
                    inputMode="tel"
                    value={assignDraft.public_phone}
                    onChange={(e) =>
                      setAssignDraft({ ...assignDraft, public_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Display order</Label>
                  <Input
                    type="number"
                    className="mt-1.5"
                    value={assignDraft.display_order}
                    onChange={(e) =>
                      setAssignDraft({ ...assignDraft, display_order: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Term start (optional)</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={assignDraft.term_start}
                    onChange={(e) => setAssignDraft({ ...assignDraft, term_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Term end (optional)</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={assignDraft.term_end}
                    onChange={(e) => setAssignDraft({ ...assignDraft, term_end: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={assignDraft.show_phone}
                  onCheckedChange={(c) =>
                    setAssignDraft({ ...assignDraft, show_phone: c === true })
                  }
                />
                Display phone number on the public Committee page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={assignDraft.is_active}
                  onCheckedChange={(c) => setAssignDraft({ ...assignDraft, is_active: c === true })}
                />
                Currently serving (active)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDraft(null)}>
              Cancel
            </Button>
            <Button variant="navy" onClick={() => void saveAssign()} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role dialog */}
      <Dialog open={!!roleDraft} onOpenChange={(o) => !o && setRoleDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleDraft?.id ? "Edit role" : "Add committee role"}</DialogTitle>
            <DialogDescription>Configure leadership titles and display order.</DialogDescription>
          </DialogHeader>
          {roleDraft && (
            <div className="space-y-4">
              <div>
                <Label>Role title</Label>
                <Input
                  className="mt-1.5"
                  value={roleDraft.role_name}
                  onChange={(e) => setRoleDraft({ ...roleDraft, role_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Display order (1 = top)</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={roleDraft.display_order}
                  onChange={(e) =>
                    setRoleDraft({ ...roleDraft, display_order: Number(e.target.value) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={roleDraft.is_multiple_allowed}
                  onCheckedChange={(c) =>
                    setRoleDraft({ ...roleDraft, is_multiple_allowed: c === true })
                  }
                />
                Allow more than one active holder (e.g. Executive Committee Members)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDraft(null)}>
              Cancel
            </Button>
            <Button variant="navy" onClick={() => void saveRole()}>
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
