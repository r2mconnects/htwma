import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DataProvider } from "../provider";
import { isDirectUrl } from "../provider";
import type {
  AdminSession,
  CommitteeAssignment,
  CommitteeRole,
  GalleryItem,
  Member,
  MemberInput,
  MemberSensitive,
  PublicCommitteeEntry,
  SiteSettings,
  StorageBucket,
} from "../types";
import { DEFAULT_SETTINGS } from "../defaults";
import { compareMemberNumbers, sensitiveLast4 } from "@/lib/members";

/**
 * SUPABASE BACKEND
 * Enable with VITE_DATA_BACKEND=supabase plus VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY (publishable key). Run docs/supabase/schema.sql first.
 * All protection is enforced by Row Level Security — the anon key is safe in the browser.
 */

const PUBLIC_BUCKETS: StorageBucket[] = ["public-media"];
const EMPTY_SENSITIVE: MemberSensitive = { aadhaar_number: "", pan_number: "", driving_licence_number: "" };

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function splitInput(input: MemberInput) {
  const { sensitive, ...rest } = input;
  const clean: MemberSensitive = {
    aadhaar_number: sensitive.aadhaar_number.replace(/[\s-]/g, ""),
    pan_number: sensitive.pan_number.trim().toUpperCase(),
    driving_licence_number: sensitive.driving_licence_number.replace(/\s/g, "").toUpperCase(),
  };
  return { row: { ...rest, member_number: rest.member_number.trim(), ...sensitiveLast4(clean) }, sensitive: clean };
}

export function createSupabaseProvider(url: string, anonKey: string): DataProvider {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  async function currentAdmin(): Promise<AdminSession | null> {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) return null;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) return null;
    const { data: profile } = await sb
      .from("admin_profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .maybeSingle();
    return {
      user_id: session.user.id,
      email: session.user.email ?? "",
      display_name: (profile?.display_name as string | undefined) ?? session.user.email ?? "Admin",
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  }

  async function audit(action: string, entityType: string, entityId: string, summary: string) {
    const { data } = await sb.auth.getUser();
    await sb.from("audit_logs").insert({
      admin_id: data.user?.id ?? null,
      admin_email: data.user?.email ?? "",
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
    });
  }

  async function upsertSensitive(memberId: string, s: MemberSensitive) {
    const { error } = await sb
      .from("member_identity_documents")
      .upsert({ member_id: memberId, ...s }, { onConflict: "member_id" });
    fail(error);
  }

  const provider: DataProvider = {
    kind: "supabase",

    auth: {
      getSession: currentAdmin,
      async needsSetup() {
        return false;
      },
      async setupFirstAdmin() {
        throw new Error("Create the first admin in your Supabase dashboard — see docs/SETUP.md.");
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Incorrect email or password.");
        const admin = await currentAdmin();
        if (!admin) {
          await sb.auth.signOut();
          throw new Error("This account is not an authorised administrator.");
        }
        await audit("sign_in", "admin", admin.user_id, "Signed in");
        return admin;
      },
      async signOut() {
        await sb.auth.signOut();
      },
      async verifyPassword(password) {
        const { data } = await sb.auth.getUser();
        if (!data.user?.email) return false;
        const { error } = await sb.auth.signInWithPassword({ email: data.user.email, password });
        return !error;
      },
      async changePassword(current, next) {
        if (!(await provider.auth.verifyPassword(current))) throw new Error("Current password is incorrect.");
        const { error } = await sb.auth.updateUser({ password: next });
        fail(error);
        await audit("change_password", "admin", "-", "Changed admin password");
      },
      async requestPasswordReset(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/admin/login`,
        });
        fail(error);
      },
    },

    members: {
      async list() {
        const { data, error } = await sb.from("members").select("*");
        fail(error);
        return ((data ?? []) as Member[]).sort((a, b) => compareMemberNumbers(a.member_number, b.member_number));
      },
      async get(id) {
        const { data, error } = await sb.from("members").select("*").eq("id", id).maybeSingle();
        fail(error);
        return (data as Member | null) ?? null;
      },
      async getSensitive(id) {
        const { data, error } = await sb
          .from("member_identity_documents")
          .select("aadhaar_number, pan_number, driving_licence_number")
          .eq("member_id", id)
          .maybeSingle();
        fail(error);
        return (data as MemberSensitive | null) ?? EMPTY_SENSITIVE;
      },
      async getSensitiveMany(ids) {
        if (!ids.length) return {};
        const { data, error } = await sb
          .from("member_identity_documents")
          .select("member_id, aadhaar_number, pan_number, driving_licence_number")
          .in("member_id", ids);
        fail(error);
        const out: Record<string, MemberSensitive> = {};
        for (const r of (data ?? []) as Array<MemberSensitive & { member_id: string }>) {
          const { member_id, ...rest } = r;
          out[member_id] = rest;
        }
        return out;
      },
      async create(input) {
        const { row, sensitive } = splitInput(input);
        const { data, error } = await sb.from("members").insert(row).select("*").single();
        if (error?.code === "23505") throw new Error(`Member ID ${input.member_number} is already used.`);
        fail(error);
        const m = data as Member;
        await upsertSensitive(m.id, sensitive);
        await audit("create", "member", m.id, `Added member #${m.member_number}`);
        return m;
      },
      async update(id, input) {
        const { row, sensitive } = splitInput(input);
        const { data, error } = await sb.from("members").update(row).eq("id", id).select("*").single();
        if (error?.code === "23505") throw new Error(`Member ID ${input.member_number} is already used.`);
        fail(error);
        await upsertSensitive(id, sensitive);
        await audit("update", "member", id, `Edited member #${input.member_number}`);
        return data as Member;
      },
      async setStatus(id, status) {
        const { error } = await sb.from("members").update({ status }).eq("id", id);
        fail(error);
        await audit(status === "archived" ? "archive" : "status", "member", id, `Set status to ${status}`);
      },
      async remove(id) {
        const m = await provider.members.get(id);
        const { error } = await sb.from("members").delete().eq("id", id);
        fail(error);
        if (m?.photo_path) await provider.files.remove("member-photos", m.photo_path);
        if (m?.signature_path) await provider.files.remove("member-signatures", m.signature_path);
        await audit("delete", "member", id, `Permanently deleted member #${m?.member_number ?? ""}`);
      },
      async isNumberTaken(num, excludeId) {
        let q = sb.from("members").select("id").ilike("member_number", num.trim());
        if (excludeId) q = q.neq("id", excludeId);
        const { data } = await q.limit(1);
        return (data ?? []).length > 0;
      },
      async bulkCreate(inputs) {
        if (!inputs.length) return 0;
        const parts = inputs.map(splitInput);
        const { data, error } = await sb
          .from("members")
          .insert(parts.map((p) => p.row))
          .select("id, member_number");
        fail(error);
        const byNumber = new Map((data ?? []).map((r) => [r.member_number as string, r.id as string]));
        const docs = parts
          .map((p) => ({ member_id: byNumber.get(p.row.member_number), ...p.sensitive }))
          .filter((d) => d.member_id);
        if (docs.length) {
          const { error: e2 } = await sb.from("member_identity_documents").insert(docs);
          fail(e2);
        }
        await audit("import", "member", "-", `Imported ${data?.length ?? 0} member(s)`);
        return data?.length ?? 0;
      },
    },

    committee: {
      async listRoles() {
        const { data, error } = await sb.from("committee_roles").select("*").order("display_order");
        fail(error);
        return (data ?? []) as CommitteeRole[];
      },
      async saveRole(role) {
        const { id, ...rest } = role;
        const q = id
          ? sb.from("committee_roles").update(rest).eq("id", id).select("*").single()
          : sb.from("committee_roles").insert(rest).select("*").single();
        const { data, error } = await q;
        fail(error);
        await audit(id ? "update" : "create", "committee_role", (data as CommitteeRole).id, `Saved role ${rest.role_name}`);
        return data as CommitteeRole;
      },
      async deleteRole(id) {
        const { error } = await sb.from("committee_roles").delete().eq("id", id);
        if (error?.code === "23503") throw new Error("Remove the people assigned to this role first.");
        fail(error);
        await audit("delete", "committee_role", id, "Deleted committee role");
      },
      async listAssignments() {
        const { data, error } = await sb.from("committee_assignments").select("*").order("display_order");
        fail(error);
        return (data ?? []) as CommitteeAssignment[];
      },
      async saveAssignment(input) {
        const { id, ...rest } = input;
        const q = id
          ? sb.from("committee_assignments").update(rest).eq("id", id).select("*").single()
          : sb.from("committee_assignments").insert(rest).select("*").single();
        const { data, error } = await q;
        if (error?.code === "23505") throw new Error("This role already has an active person.");
        fail(error);
        await audit(id ? "update" : "create", "committee", (data as CommitteeAssignment).id, "Saved committee assignment");
        return data as CommitteeAssignment;
      },
      async deleteAssignment(id) {
        const { error } = await sb.from("committee_assignments").delete().eq("id", id);
        fail(error);
        await audit("delete", "committee", id, "Removed committee assignment");
      },
      async listPublic() {
        const { data, error } = await sb.rpc("get_public_committee");
        fail(error);
        return (data ?? []) as PublicCommitteeEntry[];
      },
    },

    gallery: {
      async list() {
        const { data, error } = await sb.from("gallery_items").select("*").order("display_order");
        fail(error);
        return (data ?? []) as GalleryItem[];
      },
      async listPublished() {
        const { data, error } = await sb
          .from("gallery_items")
          .select("*")
          .eq("is_published", true)
          .order("display_order");
        fail(error);
        return (data ?? []) as GalleryItem[];
      },
      async create(input) {
        const { data, error } = await sb.from("gallery_items").insert(input).select("*").single();
        fail(error);
        await audit("create", "gallery", (data as GalleryItem).id, `Uploaded photo "${input.title}"`);
        return data as GalleryItem;
      },
      async update(id, patch) {
        const { data, error } = await sb.from("gallery_items").update(patch).eq("id", id).select("*").single();
        fail(error);
        await audit("update", "gallery", id, "Updated photo");
        return data as GalleryItem;
      },
      async remove(id) {
        const { data } = await sb.from("gallery_items").select("image_path").eq("id", id).maybeSingle();
        const { error } = await sb.from("gallery_items").delete().eq("id", id);
        fail(error);
        const path = data?.image_path as string | undefined;
        if (path && !isDirectUrl(path)) await provider.files.remove("public-media", path);
        await audit("delete", "gallery", id, "Deleted photo");
      },
      async reorder(orderedIds) {
        await Promise.all(
          orderedIds.map((id, i) => sb.from("gallery_items").update({ display_order: i + 1 }).eq("id", id)),
        );
      },
    },

    content: {
      async getSettings() {
        const { data } = await sb.from("site_content").select("body").eq("key", "settings").maybeSingle();
        return { ...DEFAULT_SETTINGS, ...((data?.body as Partial<SiteSettings> | undefined) ?? {}) };
      },
      async updateSettings(patch) {
        const next = { ...(await provider.content.getSettings()), ...patch };
        const { error } = await sb
          .from("site_content")
          .upsert({ key: "settings", title: "Site settings", body: next, updated_at: new Date().toISOString() });
        fail(error);
        await audit("update", "settings", "site", `Updated settings: ${Object.keys(patch).join(", ")}`);
        return next;
      },
    },

    files: {
      async upload(bucket, file, filename) {
        const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(bucket).upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        fail(error);
        return path;
      },
      async getUrl(bucket, path) {
        if (!path) return null;
        if (isDirectUrl(path)) return path;
        if (PUBLIC_BUCKETS.includes(bucket)) return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        const { data } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 30);
        return data?.signedUrl ?? null;
      },
      async remove(bucket, path) {
        if (!path || isDirectUrl(path)) return;
        await sb.storage.from(bucket).remove([path]);
      },
    },

    audit: {
      log: audit,
      async list(limit) {
        const { data, error } = await sb
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        fail(error);
        return (data ?? []) as never;
      },
    },

    maintenance: {
      async exportBackup() {
        const [members, roles, assignments, gallery, settings] = await Promise.all([
          provider.members.list(),
          provider.committee.listRoles(),
          provider.committee.listAssignments(),
          provider.gallery.list(),
          provider.content.getSettings(),
        ]);
        await audit("backup", "system", "-", "Downloaded records backup (no ID numbers, no files)");
        return { app: "htwma", version: 1, source: "supabase", exported_at: new Date().toISOString(), settings, members, committee_roles: roles, committee_assignments: assignments, gallery };
      },
      async restoreBackup() {
        throw new Error("Restore Supabase data from your Supabase dashboard backups (Database → Backups).");
      },
      async clearDemoData() {
        const { data: m } = await sb.from("members").delete().eq("is_demo", true).select("id");
        const { data: g } = await sb.from("gallery_items").delete().eq("is_demo", true).select("id");
        await audit("delete", "system", "-", "Removed demo data");
        return (m?.length ?? 0) + (g?.length ?? 0);
      },
    },
  };

  return provider;
}
