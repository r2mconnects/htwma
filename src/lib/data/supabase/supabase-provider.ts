import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { DataProvider } from "../provider";
import { isDirectUrl } from "../provider";
import type {
  AdminSession,
  AdminUserRecord,
  Announcement,
  AuditLog,
  CommitteeAssignment,
  CommitteeRole,
  ConfigurableField,
  ContactMessage,
  FeePayment,
  FeeType,
  GalleryItem,
  Member,
  MemberInput,
  MemberSensitive,
  PublicCommitteeEntry,
  SiteSettings,
  StorageBucket,
} from "../types";
import { DEFAULT_SETTINGS, EMPTY_SENSITIVE } from "../defaults";
import { compareMemberNumbers, normalizeMemberNumber, normalizePhone } from "@/lib/members";

/**
 * SUPABASE POSTGRESQL BACKEND
 * Connects directly to Supabase PostgreSQL + Supabase Auth + Supabase Storage.
 * Row Level Security (RLS) + SECURITY DEFINER guards enforce all authorization server-side.
 * Never pass a service_role or sb_secret_* key here — only the public anon/publishable key.
 */

const PUBLIC_BUCKETS: StorageBucket[] = ["public-media"];
const PAGE_BATCH = 1000;
const isBrowser = typeof window !== "undefined";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function cleanSensitive(s: MemberSensitive): MemberSensitive {
  return {
    aadhaar_number: s.aadhaar_number.replace(/[\s-]/g, ""),
    pan_number: s.pan_number.trim().toUpperCase(),
    driving_licence_number: s.driving_licence_number.replace(/\s+/g, "").toUpperCase(),
    aadhaar_doc_path: s.aadhaar_doc_path ?? null,
    pan_doc_path: s.pan_doc_path ?? null,
    dl_doc_path: s.dl_doc_path ?? null,
    other_doc_path: s.other_doc_path ?? null,
    other_doc_label: s.other_doc_label.trim(),
    notes: s.notes.trim(),
  };
}

function toMemberPayload(input: MemberInput): Json {
  const clean = cleanSensitive(input.sensitive);
  const mobile = input.mobile ? normalizePhone(input.mobile) : "";
  const whatsapp = input.whatsapp_number ? normalizePhone(input.whatsapp_number) : mobile;
  const emergency = input.emergency_contact ? normalizePhone(input.emergency_contact) : "";
  return {
    member_number: input.member_number.trim(),
    registration_number: input.registration_number.trim(),
    full_name: input.full_name.trim(),
    garage_name: input.garage_name.trim(),
    photo_path: input.photo_path,
    signature_path: input.signature_path,
    address: input.address.trim(),
    residence_address: input.residence_address.trim(),
    date_of_birth: input.date_of_birth ?? "",
    blood_group: input.blood_group,
    nominee_name: input.nominee_name.trim(),
    nominee_age: input.nominee_age !== null ? String(input.nominee_age) : "",
    mobile,
    whatsapp_number: whatsapp,
    emergency_contact: emergency,
    status: input.status,
    registration_date: input.registration_date ?? "",
    consent_given: input.consent_given,
    notes: input.notes.trim(),
    documents: {
      aadhaar_number: clean.aadhaar_number,
      pan_number: clean.pan_number,
      driving_licence_number: clean.driving_licence_number,
      aadhaar_doc_path: clean.aadhaar_doc_path,
      pan_doc_path: clean.pan_doc_path,
      dl_doc_path: clean.dl_doc_path,
      other_doc_path: clean.other_doc_path,
      other_doc_label: clean.other_doc_label,
      notes: clean.notes,
    },
    initial_fees: (input.initial_fees ?? []).map((f) => ({
      amount: f.amount,
      fee_type: f.fee_type,
      payment_mode: f.payment_mode,
      paid_on: f.paid_on,
      period: f.period,
      notes: f.notes ?? "Collected at registration",
    })),
  };
}

function rowToSettings(
  row: Database["public"]["Tables"]["site_settings"]["Row"] | null,
): SiteSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const reqFields = Array.isArray(row.required_fields)
    ? (row.required_fields.filter(
        (x): x is ConfigurableField => typeof x === "string",
      ) as ConfigurableField[])
    : DEFAULT_SETTINGS.required_fields;
  const rawFees =
    row.fee_defaults && typeof row.fee_defaults === "object" && !Array.isArray(row.fee_defaults)
      ? (row.fee_defaults as Record<string, unknown>)
      : {};
  const feeDefaults: Partial<Record<FeeType, number>> = {};
  for (const [k, v] of Object.entries(rawFees)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      feeDefaults[k as FeeType] = v;
    }
  }
  return {
    association_name: row.association_name || DEFAULT_SETTINGS.association_name,
    short_name: row.short_name || DEFAULT_SETTINGS.short_name,
    tagline: row.tagline || DEFAULT_SETTINGS.tagline,
    logo_path: row.logo_path ?? null,
    location_label: row.location_label || DEFAULT_SETTINGS.location_label,
    address: row.address || DEFAULT_SETTINGS.address,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    office_hours: row.office_hours,
    map_url: row.map_url,
    facebook_url: row.facebook_url,
    youtube_url: row.youtube_url,
    x_url: row.x_url,
    home_intro: row.home_intro || DEFAULT_SETTINGS.home_intro,
    about_intro: row.about_intro || DEFAULT_SETTINGS.about_intro,
    mission: row.mission || DEFAULT_SETTINGS.mission,
    vision: row.vision || DEFAULT_SETTINGS.vision,
    history: row.history || DEFAULT_SETTINGS.history,
    activities: row.activities || DEFAULT_SETTINGS.activities,
    form_code: row.form_code || DEFAULT_SETTINGS.form_code,
    required_fields: reqFields,
    fee_defaults: Object.keys(feeDefaults).length ? feeDefaults : DEFAULT_SETTINGS.fee_defaults,
  };
}

export function createSupabaseProvider(
  url: string,
  anonKey: string,
  clientOverride?: SupabaseClient<Database>,
): DataProvider {
  const sb: SupabaseClient<Database> =
    clientOverride ??
    createClient<Database>(url, anonKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    });

  async function currentAdmin(): Promise<AdminSession | null> {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) return null;
    const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return null;
    const { data: profile } = await sb
      .from("admin_users")
      .select("display_name, role, is_active")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profile && !profile.is_active) return null;
    return {
      user_id: session.user.id,
      email: session.user.email ?? "",
      display_name: profile?.display_name ?? session.user.email ?? "Admin",
      role: profile?.role ?? "admin",
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  }

  async function audit(action: string, entityType: string, entityId: string, summary: string) {
    const { data } = await sb.auth.getUser();
    if (!data.user) return;
    const { error } = await sb.from("activity_logs").insert({
      admin_id: data.user.id,
      admin_email: data.user.email ?? "",
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
    });
    if (error) console.warn("Failed to record activity log:", error.message);
  }

  const provider: DataProvider = {
    kind: "supabase",

    auth: {
      getSession: currentAdmin,
      async signIn(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        const { error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw new Error("Incorrect email or password.");
        const admin = await currentAdmin();
        if (!admin) {
          await sb.auth.signOut();
          throw new Error("This account is not an authorised HTWMA administrator.");
        }
        await sb
          .from("admin_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", admin.user_id);
        await audit("sign_in", "admin", admin.user_id, "Administrator signed in");
        return admin;
      },
      async signOut() {
        await sb.auth.signOut();
      },
      async verifyPassword(password) {
        const { data } = await sb.auth.getUser();
        if (!data.user?.email) return false;
        // Use a stateless ephemeral client so active session refresh tokens are never rotated/invalidated
        const verifier = clientOverride
          ? sb
          : createClient<Database>(url, anonKey, {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: "htwma-ephemeral-verify",
              },
            });
        const { error } = await verifier.auth.signInWithPassword({
          email: data.user.email,
          password,
        });
        return !error;
      },
      async changePassword(current, next) {
        if (!(await provider.auth.verifyPassword(current)))
          throw new Error("Current password is incorrect.");
        const { error } = await sb.auth.updateUser({ password: next });
        fail(error);
        await audit("change_password", "admin", "-", "Changed administrator password");
      },
      async requestPasswordReset(email) {
        const redirectTo = isBrowser ? `${window.location.origin}/admin/login` : undefined;
        const { error } = await sb.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          redirectTo ? { redirectTo } : undefined,
        );
        fail(error);
      },
      async listAdmins() {
        const { data, error } = await sb
          .from("admin_users")
          .select("id, email, display_name, role, is_active, last_login_at, created_at")
          .order("created_at", { ascending: true });
        fail(error);
        return (data ?? []) as AdminUserRecord[];
      },
    },

    members: {
      async list() {
        const all: Member[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await sb
            .from("members")
            .select("*")
            .order("created_at", { ascending: true })
            .range(from, from + PAGE_BATCH - 1);
          fail(error);
          const batch = (data ?? []) as Member[];
          all.push(...batch);
          if (batch.length < PAGE_BATCH) break;
          from += PAGE_BATCH;
        }
        return all.sort((a, b) => compareMemberNumbers(a.member_number, b.member_number));
      },
      async get(id) {
        const { data, error } = await sb.from("members").select("*").eq("id", id).maybeSingle();
        fail(error);
        return (data as Member | null) ?? null;
      },
      async peekNextNumber() {
        const { data, error } = await sb.rpc("peek_next_member_number");
        fail(error);
        return data ?? "001";
      },
      async getSensitive(id) {
        const { data, error } = await sb
          .from("member_documents")
          .select(
            "aadhaar_number, pan_number, driving_licence_number, aadhaar_doc_path, pan_doc_path, dl_doc_path, other_doc_path, other_doc_label, notes",
          )
          .eq("member_id", id)
          .maybeSingle();
        fail(error);
        return data ? (data as MemberSensitive) : { ...EMPTY_SENSITIVE };
      },
      async getSensitiveMany(ids) {
        if (!ids.length) return {};
        const out: Record<string, MemberSensitive> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { data, error } = await sb
            .from("member_documents")
            .select(
              "member_id, aadhaar_number, pan_number, driving_licence_number, aadhaar_doc_path, pan_doc_path, dl_doc_path, other_doc_path, other_doc_label, notes",
            )
            .in("member_id", chunk);
          fail(error);
          for (const r of data ?? []) {
            const { member_id, ...rest } = r;
            out[member_id] = rest;
          }
        }
        return out;
      },
      async create(input) {
        const { data, error } = await sb.rpc("upsert_member_with_documents", {
          p_member_id: null,
          p_payload: toMemberPayload(input),
        });
        if (error?.code === "23505") {
          throw new Error(
            `Member ID ${input.member_number || "(auto)"} is already used by another member.`,
          );
        }
        fail(error);
        return data as Member;
      },
      async update(id, input) {
        const { data, error } = await sb.rpc("upsert_member_with_documents", {
          p_member_id: id,
          p_payload: toMemberPayload(input),
        });
        if (error?.code === "23505") {
          throw new Error(`Member ID ${input.member_number} is already used by another member.`);
        }
        fail(error);
        return data as Member;
      },
      async setStatus(id, status) {
        const existing = await provider.members.get(id);
        const { error } = await sb.from("members").update({ status }).eq("id", id);
        fail(error);
        const verb =
          status === "archived"
            ? "archive"
            : status === "active" && existing?.status === "archived"
              ? "restore"
              : "status";
        await audit(
          verb,
          "member",
          id,
          `Set member #${existing?.member_number ?? id} status to ${status}`,
        );
      },
      async remove(id) {
        const { data, error } = await sb.rpc("delete_member_permanently", { p_member_id: id });
        fail(error);
        const paths = (
          data && typeof data === "object" && !Array.isArray(data) ? data : {}
        ) as Record<string, unknown>;
        const photoPath = typeof paths["photo_path"] === "string" ? paths["photo_path"] : null;
        const sigPath =
          typeof paths["signature_path"] === "string" ? paths["signature_path"] : null;
        if (photoPath)
          await provider.files.remove("member-photos", photoPath).catch(() => undefined);
        if (sigPath)
          await provider.files.remove("member-signatures", sigPath).catch(() => undefined);
        for (const docKey of [
          "aadhaar_doc_path",
          "pan_doc_path",
          "dl_doc_path",
          "other_doc_path",
        ] as const) {
          const p = typeof paths[docKey] === "string" ? paths[docKey] : null;
          if (p) await provider.files.remove("member-documents", p).catch(() => undefined);
        }
      },
      async isNumberTaken(num, excludeId) {
        const norm = normalizeMemberNumber(num);
        if (!norm) return false;
        let q = sb.from("members").select("id").eq("normalized_member_number", norm);
        if (excludeId) q = q.neq("id", excludeId);
        const { data, error } = await q.limit(1);
        fail(error);
        return (data ?? []).length > 0;
      },
      async bulkCreate(inputs) {
        if (!inputs.length) return 0;
        const rows = inputs.map((inp) => toMemberPayload(inp));
        const { data, error } = await sb.rpc("bulk_import_members", { p_rows: rows });
        fail(error);
        return Number(data ?? 0);
      },
    },

    fees: {
      async list() {
        const all: FeePayment[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await sb
            .from("member_fees")
            .select("*")
            .order("paid_on", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_BATCH - 1);
          fail(error);
          const batch = ((data ?? []) as FeePayment[]).map((p) => ({
            ...p,
            amount: Number(p.amount),
          }));
          all.push(...batch);
          if (batch.length < PAGE_BATCH) break;
          from += PAGE_BATCH;
        }
        return all;
      },
      async create(input) {
        const { data, error } = await sb
          .from("member_fees")
          .insert({
            member_id: input.member_id,
            amount: input.amount,
            fee_type: input.fee_type,
            payment_mode: input.payment_mode,
            paid_on: input.paid_on,
            period: input.period.trim(),
            receipt_number: input.receipt_number.trim(),
            notes: input.notes.trim(),
          })
          .select("*")
          .single();
        if (error?.code === "23505")
          throw new Error(`Receipt number ${input.receipt_number} is already used.`);
        fail(error);
        const p = data as FeePayment;
        await audit(
          "create",
          "fee",
          p.id,
          `Recorded ₹${p.amount} ${p.fee_type} fee (receipt ${p.receipt_number})`,
        );
        return { ...p, amount: Number(p.amount) };
      },
      async update(id, input) {
        const { data, error } = await sb
          .from("member_fees")
          .update({
            member_id: input.member_id,
            amount: input.amount,
            fee_type: input.fee_type,
            payment_mode: input.payment_mode,
            paid_on: input.paid_on,
            period: input.period.trim(),
            receipt_number: input.receipt_number.trim(),
            notes: input.notes.trim(),
          })
          .eq("id", id)
          .select("*")
          .single();
        if (error?.code === "23505")
          throw new Error(`Receipt number ${input.receipt_number} is already used.`);
        fail(error);
        const p = data as FeePayment;
        await audit("update", "fee", id, `Updated payment ${p.receipt_number} (₹${p.amount})`);
        return { ...p, amount: Number(p.amount) };
      },
      async remove(id) {
        const { data: existing } = await sb
          .from("member_fees")
          .select("receipt_number, amount")
          .eq("id", id)
          .maybeSingle();
        const { error } = await sb.from("member_fees").delete().eq("id", id);
        fail(error);
        await audit(
          "delete",
          "fee",
          id,
          `Deleted payment ${existing?.receipt_number ?? ""} (₹${existing?.amount ?? 0})`,
        );
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
        if (error?.code === "23505") throw new Error(`Role "${rest.role_name}" already exists.`);
        fail(error);
        const saved = data as CommitteeRole;
        await audit(
          id ? "update" : "create",
          "committee_role",
          saved.id,
          `${id ? "Updated" : "Added"} committee role ${saved.role_name}`,
        );
        return saved;
      },
      async deleteRole(id) {
        const { error } = await sb.from("committee_roles").delete().eq("id", id);
        if (error?.code === "23503")
          throw new Error("Remove the people assigned to this role first.");
        fail(error);
        await audit("delete", "committee_role", id, "Deleted committee role");
      },
      async listAssignments() {
        const { data, error } = await sb
          .from("committee_members")
          .select("*")
          .order("display_order");
        fail(error);
        return (data ?? []) as CommitteeAssignment[];
      },
      async saveAssignment(input) {
        const { id, ...rest } = input;
        const payload = {
          member_id: rest.member_id,
          role_id: rest.role_id,
          term_start: rest.term_start,
          term_end: rest.term_end,
          public_phone: rest.public_phone ? normalizePhone(rest.public_phone) : "",
          show_phone: rest.show_phone,
          public_photo_path: rest.public_photo_path,
          display_order: rest.display_order,
          is_active: rest.is_active,
        };
        const q = id
          ? sb.from("committee_members").update(payload).eq("id", id).select("*").single()
          : sb.from("committee_members").insert(payload).select("*").single();
        const { data, error } = await q;
        if (error?.code === "23505")
          throw new Error(error.message || "This role already has an active office-bearer.");
        fail(error);
        const saved = data as CommitteeAssignment;
        await audit(
          id ? "update" : "create",
          "committee",
          saved.id,
          `${id ? "Updated" : "Assigned"} committee office-bearer`,
        );
        return saved;
      },
      async deleteAssignment(id) {
        const { data: existing } = await sb
          .from("committee_members")
          .select("public_photo_path")
          .eq("id", id)
          .maybeSingle();
        const { error } = await sb.from("committee_members").delete().eq("id", id);
        fail(error);
        if (existing?.public_photo_path && !isDirectUrl(existing.public_photo_path)) {
          await provider.files
            .remove("public-media", existing.public_photo_path)
            .catch(() => undefined);
        }
        await audit("delete", "committee", id, "Removed committee office-bearer");
      },
      async listPublic() {
        const { data, error } = await sb.rpc("get_public_committee");
        fail(error);
        return (data ?? []) as PublicCommitteeEntry[];
      },
    },

    gallery: {
      async list() {
        const { data, error } = await sb
          .from("gallery")
          .select("*")
          .order("display_order", { ascending: true })
          .order("uploaded_at", { ascending: false });
        fail(error);
        return (data ?? []) as GalleryItem[];
      },
      async listPublished() {
        const { data, error } = await sb
          .from("gallery")
          .select("*")
          .eq("is_published", true)
          .order("display_order", { ascending: true })
          .order("uploaded_at", { ascending: false });
        fail(error);
        return (data ?? []) as GalleryItem[];
      },
      async create(input) {
        const { data: userRes } = await sb.auth.getUser();
        const { data, error } = await sb
          .from("gallery")
          .insert({
            ...input,
            title: input.title.trim(),
            uploaded_by: userRes.user?.id ?? null,
          })
          .select("*")
          .single();
        fail(error);
        const saved = data as GalleryItem;
        await audit("create", "gallery", saved.id, `Uploaded gallery photo "${saved.title}"`);
        return saved;
      },
      async update(id, patch) {
        const { data, error } = await sb
          .from("gallery")
          .update(patch)
          .eq("id", id)
          .select("*")
          .single();
        fail(error);
        const saved = data as GalleryItem;
        await audit("update", "gallery", id, `Updated gallery photo "${saved.title}"`);
        return saved;
      },
      async remove(id) {
        const { data: existing } = await sb
          .from("gallery")
          .select("image_path, title")
          .eq("id", id)
          .maybeSingle();
        const { error } = await sb.from("gallery").delete().eq("id", id);
        fail(error);
        const path = existing?.image_path;
        if (path && !isDirectUrl(path))
          await provider.files.remove("public-media", path).catch(() => undefined);
        await audit("delete", "gallery", id, `Deleted gallery photo "${existing?.title ?? ""}"`);
      },
      async reorder(orderedIds) {
        const results = await Promise.all(
          orderedIds.map((id, i) =>
            sb
              .from("gallery")
              .update({ display_order: i + 1 })
              .eq("id", id),
          ),
        );
        for (const r of results) fail(r.error);
      },
    },

    announcements: {
      async list() {
        const { data, error } = await sb
          .from("announcements")
          .select("*")
          .order("is_pinned", { ascending: false })
          .order("published_date", { ascending: false })
          .order("created_at", { ascending: false });
        fail(error);
        return (data ?? []) as Announcement[];
      },
      async listPublished() {
        const { data, error } = await sb
          .from("announcements")
          .select("*")
          .eq("is_published", true)
          .order("is_pinned", { ascending: false })
          .order("published_date", { ascending: false })
          .order("created_at", { ascending: false });
        fail(error);
        return (data ?? []) as Announcement[];
      },
      async create(input) {
        const { data: userRes } = await sb.auth.getUser();
        const { data, error } = await sb
          .from("announcements")
          .insert({
            title: input.title.trim(),
            body: input.body.trim(),
            category: input.category,
            published_date: input.published_date,
            is_published: input.is_published,
            is_pinned: input.is_pinned,
            created_by: userRes.user?.id ?? null,
          })
          .select("*")
          .single();
        fail(error);
        const saved = data as Announcement;
        await audit("create", "announcement", saved.id, `Published announcement "${saved.title}"`);
        return saved;
      },
      async update(id, patch) {
        const cleanPatch: Database["public"]["Tables"]["announcements"]["Update"] = {};
        if (patch.title !== undefined) cleanPatch.title = patch.title.trim();
        if (patch.body !== undefined) cleanPatch.body = patch.body.trim();
        if (patch.category !== undefined) cleanPatch.category = patch.category;
        if (patch.published_date !== undefined) cleanPatch.published_date = patch.published_date;
        if (patch.is_published !== undefined) cleanPatch.is_published = patch.is_published;
        if (patch.is_pinned !== undefined) cleanPatch.is_pinned = patch.is_pinned;
        const { data, error } = await sb
          .from("announcements")
          .update(cleanPatch)
          .eq("id", id)
          .select("*")
          .single();
        fail(error);
        const saved = data as Announcement;
        await audit("update", "announcement", id, `Updated announcement "${saved.title}"`);
        return saved;
      },
      async remove(id) {
        const { data: existing } = await sb
          .from("announcements")
          .select("title")
          .eq("id", id)
          .maybeSingle();
        const { error } = await sb.from("announcements").delete().eq("id", id);
        fail(error);
        await audit(
          "delete",
          "announcement",
          id,
          `Deleted announcement "${existing?.title ?? ""}"`,
        );
      },
    },

    messages: {
      async submit(input) {
        const { data, error } = await sb.rpc("submit_contact_message", {
          p_sender_name: input.sender_name.trim(),
          p_sender_phone: input.sender_phone ? normalizePhone(input.sender_phone) : "",
          p_sender_email: input.sender_email?.trim().toLowerCase() ?? "",
          p_subject: input.subject?.trim() ?? "",
          p_message: input.message.trim(),
        });
        fail(error);
        return String(data ?? "");
      },
      async list() {
        const { data, error } = await sb
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false });
        fail(error);
        return (data ?? []) as ContactMessage[];
      },
      async update(id, patch) {
        const { data: userRes } = await sb.auth.getUser();
        const updateRow: Database["public"]["Tables"]["contact_messages"]["Update"] = {};
        if (patch.status !== undefined) {
          updateRow.status = patch.status;
          if (patch.status === "replied") updateRow.replied_by = userRes.user?.id ?? null;
        }
        if (patch.admin_notes !== undefined) updateRow.admin_notes = patch.admin_notes.trim();
        const { data, error } = await sb
          .from("contact_messages")
          .update(updateRow)
          .eq("id", id)
          .select("*")
          .single();
        fail(error);
        const saved = data as ContactMessage;
        await audit(
          "update",
          "contact_message",
          id,
          `Updated message from ${saved.sender_name} (${saved.status})`,
        );
        return saved;
      },
      async remove(id) {
        const { data: existing } = await sb
          .from("contact_messages")
          .select("sender_name")
          .eq("id", id)
          .maybeSingle();
        const { error } = await sb.from("contact_messages").delete().eq("id", id);
        fail(error);
        await audit(
          "delete",
          "contact_message",
          id,
          `Deleted contact message from ${existing?.sender_name ?? "visitor"}`,
        );
      },
    },

    content: {
      async getSettings() {
        const { data, error } = await sb
          .from("site_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();
        fail(error);
        return rowToSettings(data);
      },
      async updateSettings(patch) {
        const { data: userRes } = await sb.auth.getUser();
        const current = await provider.content.getSettings();
        const merged: SiteSettings = { ...current, ...patch };
        const { data, error } = await sb
          .from("site_settings")
          .upsert({
            id: "default",
            association_name: merged.association_name,
            short_name: merged.short_name,
            tagline: merged.tagline,
            logo_path: merged.logo_path,
            location_label: merged.location_label,
            address: merged.address,
            phone: merged.phone,
            whatsapp: merged.whatsapp,
            email: merged.email,
            office_hours: merged.office_hours,
            map_url: merged.map_url,
            facebook_url: merged.facebook_url,
            youtube_url: merged.youtube_url,
            x_url: merged.x_url,
            home_intro: merged.home_intro,
            about_intro: merged.about_intro,
            mission: merged.mission,
            vision: merged.vision,
            history: merged.history,
            activities: merged.activities,
            form_code: merged.form_code,
            required_fields: merged.required_fields as unknown as Json,
            fee_defaults: merged.fee_defaults as unknown as Json,
            updated_by: userRes.user?.id ?? null,
          })
          .select("*")
          .single();
        fail(error);
        await audit(
          "update",
          "settings",
          "default",
          `Updated website settings (${Object.keys(patch).join(", ")})`,
        );
        return rowToSettings(data);
      },
    },

    files: {
      async upload(bucket, file, filename) {
        const ext =
          (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const folder = new Date().toISOString().slice(0, 7);
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(bucket).upload(path, file, {
          contentType: file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg"),
          upsert: false,
        });
        fail(error);
        return path;
      },
      async getUrl(bucket, path) {
        if (!path) return null;
        if (isDirectUrl(path)) return path;
        if (PUBLIC_BUCKETS.includes(bucket)) {
          return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        }
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 30);
        if (error) return null;
        return data?.signedUrl ?? null;
      },
      async remove(bucket, path) {
        if (!path || isDirectUrl(path)) return;
        const { error } = await sb.storage.from(bucket).remove([path]);
        fail(error);
      },
    },

    audit: {
      log: audit,
      async list(limit) {
        const { data, error } = await sb
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        fail(error);
        return (data ?? []) as AuditLog[];
      },
    },

    maintenance: {
      async exportBackup() {
        const [members, roles, assignments, gallery, announcements, messages, settings, fees] =
          await Promise.all([
            provider.members.list(),
            provider.committee.listRoles(),
            provider.committee.listAssignments(),
            provider.gallery.list(),
            provider.announcements.list(),
            provider.messages.list(),
            provider.content.getSettings(),
            provider.fees.list(),
          ]);
        await audit(
          "backup",
          "system",
          "-",
          "Exported JSON snapshot of association records (sensitive IDs excluded)",
        );
        return {
          app: "htwma",
          version: 2,
          source: "supabase",
          exported_at: new Date().toISOString(),
          settings,
          members,
          committee_roles: roles,
          committee_members: assignments,
          gallery,
          announcements,
          contact_messages: messages,
          fees,
        };
      },
      async clearDemoData() {
        const { data: demoFees, error: e1 } = await sb
          .from("member_fees")
          .delete()
          .eq("is_demo", true)
          .select("id");
        fail(e1);
        const { data: demoGallery, error: e2 } = await sb
          .from("gallery")
          .delete()
          .eq("is_demo", true)
          .select("id, image_path");
        fail(e2);
        for (const g of demoGallery ?? []) {
          if (g.image_path && !isDirectUrl(g.image_path)) {
            await provider.files.remove("public-media", g.image_path).catch(() => undefined);
          }
        }
        const { data: demoMembers, error: e3 } = await sb
          .from("members")
          .delete()
          .eq("is_demo", true)
          .select("id, photo_path, signature_path");
        fail(e3);
        for (const m of demoMembers ?? []) {
          if (m.photo_path)
            await provider.files.remove("member-photos", m.photo_path).catch(() => undefined);
          if (m.signature_path)
            await provider.files
              .remove("member-signatures", m.signature_path)
              .catch(() => undefined);
        }
        const total =
          (demoMembers?.length ?? 0) + (demoGallery?.length ?? 0) + (demoFees?.length ?? 0);
        await audit("delete", "system", "-", `Removed ${total} demo item(s)`);
        return total;
      },
    },
  };

  return provider;
}
