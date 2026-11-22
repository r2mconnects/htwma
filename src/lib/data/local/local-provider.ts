import { createStore, get as idbGet, set as idbSet, del as idbDel, entries as idbEntries } from "idb-keyval";
import type { DataProvider } from "../provider";
import { isDirectUrl } from "../provider";
import type {
  AdminSession,
  AuditLog,
  CommitteeAssignment,
  CommitteeRole,
  FeePayment,
  GalleryItem,
  Member,
  MemberInput,
  MemberSensitive,
  SiteSettings,
  StorageBucket,
} from "../types";
import { DEFAULT_SETTINGS } from "../defaults";
import { buildSeed } from "./seed";
import { compareMemberNumbers, normalizeMemberNumber, sensitiveLast4 } from "@/lib/members";
import { nextReceiptNumber } from "@/lib/fees";

/**
 * LOCAL BROWSER BACKEND
 * Records → localStorage, images → IndexedDB. Data lives only in this browser.
 * Good for setup, demos and trying the system. For real member records with
 * multiple devices, switch to Supabase (see docs/SETUP.md).
 */

const K = {
  seeded: "htwma.seeded.v1",
  settings: "htwma.settings",
  members: "htwma.members",
  private: "htwma.member_private",
  roles: "htwma.committee_roles",
  assignments: "htwma.committee_assignments",
  gallery: "htwma.gallery",
  audit: "htwma.audit",
  admin: "htwma.admin.v2",
  fees: "htwma.fees",
  feesSeeded: "htwma.seeded.fees.v1",
  session: "htwma.session",
  attempts: "htwma.login_attempts",
} as const;

const SESSION_HOURS = 8;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const PBKDF2_ITERATIONS = 210_000;

const isBrowser = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Browser storage is full. Export a backup and remove unused records or photos.");
  }
}

function ensureSeeded() {
  if (!isBrowser() || localStorage.getItem(K.seeded)) return;
  const seed = buildSeed();
  write(K.settings, DEFAULT_SETTINGS);
  write(K.roles, seed.roles);
  write(K.members, seed.members);
  write(K.private, seed.privateData);
  write(K.assignments, seed.assignments);
  write(K.gallery, seed.gallery);
  write(K.audit, []);
  localStorage.setItem(K.seeded, new Date().toISOString());
}

/** Demo fee payments for the demo members (added once, also for browsers seeded earlier). */
function ensureFeesSeeded() {
  if (!isBrowser() || localStorage.getItem(K.feesSeeded)) return;
  const existing = read<FeePayment[]>(K.fees, []);
  const demo = read<Member[]>(K.members, []).filter((m) => m.is_demo && m.status !== "archived");
  const year = String(new Date().getFullYear());
  const payments: FeePayment[] = [];
  demo.forEach((m, i) => {
    const day = `${year}-11-${String(Math.min(2 + i, 20)).padStart(2, "0")}`;
    payments.push(demoPayment(m.id, "Registration", day, "", payments.length + existing.length + 1));
    if (i < 3) payments.push(demoPayment(m.id, "Annual", day, year, payments.length + existing.length + 1));
  });
  write(K.fees, [...existing, ...payments]);
  localStorage.setItem(K.feesSeeded, new Date().toISOString());
}

function demoPayment(memberId: string, type: FeePayment["fee_type"], day: string, period: string, n: number): FeePayment {
  return {
    id: crypto.randomUUID(),
    member_id: memberId,
    amount: 199,
    fee_type: type,
    payment_mode: n % 2 ? "Cash" : "UPI",
    paid_on: day,
    period,
    receipt_number: `R-${String(n).padStart(4, "0")}`,
    notes: "Demo payment — safe to delete.",
    is_demo: true,
    created_at: new Date().toISOString(),
  };
}

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

// ---------- password hashing (PBKDF2-SHA256 via WebCrypto) ----------
const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toB64(bits);
}

interface StoredAdmin {
  user_id: string;
  email: string;
  display_name: string;
  salt: string;
  hash: string;
  iterations: number;
}

/**
 * Built-in admin account for local mode: htwma@gmail.com.
 * Only a PBKDF2 hash of the default password is stored here. Changing the
 * password in Settings replaces it for this browser.
 */
export const DEFAULT_ADMIN_EMAIL = "htwma@gmail.com";
const DEFAULT_ADMIN: StoredAdmin = {
  user_id: "00000000-0000-4000-8000-000000000001",
  email: DEFAULT_ADMIN_EMAIL,
  display_name: "HTWMA Admin",
  salt: "aHR3bWEtZGVmYXVsdC12MQ==",
  hash: "kZDhMTRsyBA02eeuyAG4f/9V/DX6hEOCSEIXICmN4K0=",
  iterations: PBKDF2_ITERATIONS,
};

function getAdmin(): StoredAdmin {
  const stored = read<StoredAdmin | null>(K.admin, null);
  if (stored) return stored;
  if (isBrowser()) write(K.admin, DEFAULT_ADMIN);
  return DEFAULT_ADMIN;
}

function requireAdmin(): AdminSession {
  const s = read<AdminSession | null>(K.session, null);
  if (!s || (s.expires_at && new Date(s.expires_at) < new Date())) {
    throw new Error("Your admin session has expired. Please sign in again.");
  }
  return s;
}

function startSession(admin: StoredAdmin): AdminSession {
  const session: AdminSession = {
    user_id: admin.user_id,
    email: admin.email,
    display_name: admin.display_name,
    expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
  };
  write(K.session, session);
  return session;
}

async function audit(action: string, entityType: string, entityId: string, summary: string) {
  const s = read<AdminSession | null>(K.session, null);
  const logs = read<AuditLog[]>(K.audit, []);
  logs.unshift({
    id: uid(),
    admin_email: s?.email ?? "unknown",
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    created_at: now(),
  });
  write(K.audit, logs.slice(0, 1000));
}

// ---------- files (IndexedDB) ----------
const fileStore = () => createStore("htwma-files", "blobs");
const urlCache = new Map<string, string>();

function sanitizeSensitive(s: MemberSensitive): MemberSensitive {
  return {
    aadhaar_number: s.aadhaar_number.replace(/[\s-]/g, ""),
    pan_number: s.pan_number.trim().toUpperCase(),
    driving_licence_number: s.driving_licence_number.replace(/\s/g, "").toUpperCase(),
  };
}

function inputToMember(input: MemberInput, existing: Member | null): Member {
  const { sensitive, ...rest } = input;
  const t = now();
  return {
    ...(existing ?? { id: uid(), created_at: t, is_demo: false }),
    ...rest,
    member_number: input.member_number.trim(),
    ...sensitiveLast4(sanitizeSensitive(sensitive)),
    updated_at: t,
  } as Member;
}

export function createLocalProvider(): DataProvider {
  const members = () => {
    ensureSeeded();
    return read<Member[]>(K.members, []);
  };
  const privateMap = () => read<Record<string, MemberSensitive>>(K.private, {});
  const roles = () => {
    ensureSeeded();
    return read<CommitteeRole[]>(K.roles, []);
  };
  const assignments = () => {
    ensureSeeded();
    return read<CommitteeAssignment[]>(K.assignments, []);
  };
  const gallery = () => {
    ensureSeeded();
    return read<GalleryItem[]>(K.gallery, []);
  };

  const fees = () => {
    ensureSeeded();
    ensureFeesSeeded();
    return read<FeePayment[]>(K.fees, []);
  };

  const numberTaken = (num: string, excludeId: string | null) => {
    const n = normalizeMemberNumber(num);
    return members().some((m) => m.id !== excludeId && normalizeMemberNumber(m.member_number) === n);
  };

  const provider: DataProvider = {
    kind: "local",

    auth: {
      async getSession() {
        if (!isBrowser()) return null;
        const s = read<AdminSession | null>(K.session, null);
        if (!s) return null;
        if (s.expires_at && new Date(s.expires_at) < new Date()) {
          localStorage.removeItem(K.session);
          return null;
        }
        if (s.user_id !== getAdmin().user_id) return null;
        return s;
      },
      async signIn(email, password) {
        const attempts = read<{ count: number; until: number }>(K.attempts, { count: 0, until: 0 });
        if (attempts.until > Date.now()) {
          const mins = Math.ceil((attempts.until - Date.now()) / 60000);
          throw new Error(`Too many failed attempts. Try again in ${mins} minute(s).`);
        }
        const admin = getAdmin();
        const ok =
          admin.email === email.trim().toLowerCase() &&
          (await hashPassword(password, fromB64(admin.salt), admin.iterations)) === admin.hash;
        if (!ok) {
          const count = attempts.count + 1;
          write(K.attempts, {
            count: count >= MAX_ATTEMPTS ? 0 : count,
            until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : 0,
          });
          throw new Error("Incorrect email or password.");
        }
        localStorage.removeItem(K.attempts);
        const session = startSession(admin);
        await audit("sign_in", "admin", admin.user_id, "Signed in");
        return session;
      },
      async signOut() {
        if (isBrowser()) localStorage.removeItem(K.session);
      },
      async verifyPassword(password) {
        const admin = getAdmin();
        return (await hashPassword(password, fromB64(admin.salt), admin.iterations)) === admin.hash;
      },
      async changePassword(current, next) {
        requireAdmin();
        const admin = getAdmin();
        if (!(await provider.auth.verifyPassword(current))) {
          throw new Error("Current password is incorrect.");
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        write(K.admin, {
          ...admin,
          salt: toB64(salt),
          hash: await hashPassword(next, salt, PBKDF2_ITERATIONS),
          iterations: PBKDF2_ITERATIONS,
        });
        await audit("change_password", "admin", admin.user_id, "Changed admin password");
      },
      async requestPasswordReset() {
        throw new Error(
          "Password reset by email is available after connecting Supabase.",
        );
      },
    },

    members: {
      async list() {
        requireAdmin();
        return [...members()].sort((a, b) => compareMemberNumbers(a.member_number, b.member_number));
      },
      async get(id) {
        requireAdmin();
        return members().find((m) => m.id === id) ?? null;
      },
      async getSensitive(id) {
        requireAdmin();
        return privateMap()[id] ?? { aadhaar_number: "", pan_number: "", driving_licence_number: "" };
      },
      async getSensitiveMany(ids) {
        requireAdmin();
        const map = privateMap();
        const out: Record<string, MemberSensitive> = {};
        ids.forEach((id) => {
          const v = map[id];
          if (v) out[id] = v;
        });
        return out;
      },
      async create(input) {
        requireAdmin();
        if (numberTaken(input.member_number, null)) {
          throw new Error(`Member ID ${input.member_number} is already used by another member.`);
        }
        const m = inputToMember(input, null);
        write(K.members, [...members(), m]);
        write(K.private, { ...privateMap(), [m.id]: sanitizeSensitive(input.sensitive) });
        await audit("create", "member", m.id, `Added member #${m.member_number}`);
        return m;
      },
      async update(id, input) {
        requireAdmin();
        const list = members();
        const existing = list.find((m) => m.id === id);
        if (!existing) throw new Error("Member not found.");
        if (numberTaken(input.member_number, id)) {
          throw new Error(`Member ID ${input.member_number} is already used by another member.`);
        }
        const m = inputToMember(input, existing);
        write(
          K.members,
          list.map((x) => (x.id === id ? m : x)),
        );
        write(K.private, { ...privateMap(), [id]: sanitizeSensitive(input.sensitive) });
        await audit("update", "member", id, `Edited member #${m.member_number}`);
        return m;
      },
      async setStatus(id, status) {
        requireAdmin();
        const list = members();
        const m = list.find((x) => x.id === id);
        if (!m) throw new Error("Member not found.");
        write(
          K.members,
          list.map((x) => (x.id === id ? { ...x, status, updated_at: now() } : x)),
        );
        await audit(status === "archived" ? "archive" : "status", "member", id, `Set #${m.member_number} to ${status}`);
      },
      async remove(id) {
        requireAdmin();
        const m = members().find((x) => x.id === id);
        if (!m) return;
        write(
          K.members,
          members().filter((x) => x.id !== id),
        );
        const priv = privateMap();
        delete priv[id];
        write(K.private, priv);
        write(
          K.assignments,
          assignments().filter((a) => a.member_id !== id),
        );
        write(K.fees, fees().filter((f) => f.member_id !== id));
        if (m.photo_path) await provider.files.remove("member-photos", m.photo_path);
        if (m.signature_path) await provider.files.remove("member-signatures", m.signature_path);
        await audit("delete", "member", id, `Permanently deleted member #${m.member_number}`);
      },
      async isNumberTaken(num, excludeId) {
        return numberTaken(num, excludeId);
      },
      async bulkCreate(inputs) {
        requireAdmin();
        const list = members();
        const priv = privateMap();
        const seen = new Set(list.map((m) => normalizeMemberNumber(m.member_number)));
        let added = 0;
        for (const input of inputs) {
          const n = normalizeMemberNumber(input.member_number);
          if (seen.has(n)) continue;
          seen.add(n);
          const m = inputToMember(input, null);
          list.push(m);
          priv[m.id] = sanitizeSensitive(input.sensitive);
          added++;
        }
        write(K.members, list);
        write(K.private, priv);
        await audit("import", "member", "-", `Imported ${added} member(s)`);
        return added;
      },
    },

    fees: {
      async list() {
        requireAdmin();
        return [...fees()].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at));
      },
      async create(input) {
        requireAdmin();
        const list = fees();
        const member = members().find((m) => m.id === input.member_id);
        if (!member) throw new Error("Choose a valid member.");
        const receipt = input.receipt_number.trim() || nextReceiptNumber(list.map((f) => f.receipt_number));
        if (list.some((f) => f.receipt_number.toUpperCase() === receipt.toUpperCase())) {
          throw new Error(`Receipt number ${receipt} is already used.`);
        }
        const p: FeePayment = { ...input, receipt_number: receipt, id: uid(), created_at: now(), is_demo: false };
        write(K.fees, [...list, p]);
        await audit("create", "fee", p.id, `Recorded ₹${p.amount} ${p.fee_type} fee for #${member.member_number} (receipt ${receipt})`);
        return p;
      },
      async update(id, input) {
        requireAdmin();
        const list = fees();
        const existing = list.find((f) => f.id === id);
        if (!existing) throw new Error("Payment not found.");
        const receipt = input.receipt_number.trim() || existing.receipt_number;
        if (list.some((f) => f.id !== id && f.receipt_number.toUpperCase() === receipt.toUpperCase())) {
          throw new Error(`Receipt number ${receipt} is already used.`);
        }
        const updated: FeePayment = { ...existing, ...input, receipt_number: receipt };
        write(K.fees, list.map((f) => (f.id === id ? updated : f)));
        await audit("update", "fee", id, `Edited payment ${receipt} (₹${updated.amount})`);
        return updated;
      },
      async remove(id) {
        requireAdmin();
        const p = fees().find((f) => f.id === id);
        write(K.fees, fees().filter((f) => f.id !== id));
        await audit("delete", "fee", id, `Deleted payment ${p?.receipt_number ?? ""} (₹${p?.amount ?? 0})`);
      },
    },

    committee: {
      async listRoles() {
        return [...roles()].sort((a, b) => a.display_order - b.display_order);
      },
      async saveRole(role) {
        requireAdmin();
        const list = roles();
        if (role.id) {
          const updated = { ...role, id: role.id };
          write(
            K.roles,
            list.map((r) => (r.id === role.id ? updated : r)),
          );
          await audit("update", "committee_role", role.id, `Updated role ${role.role_name}`);
          return updated;
        }
        const created: CommitteeRole = { ...role, id: uid() };
        write(K.roles, [...list, created]);
        await audit("create", "committee_role", created.id, `Added role ${role.role_name}`);
        return created;
      },
      async deleteRole(id) {
        requireAdmin();
        if (assignments().some((a) => a.role_id === id)) {
          throw new Error("Remove the people assigned to this role first.");
        }
        write(
          K.roles,
          roles().filter((r) => r.id !== id),
        );
        await audit("delete", "committee_role", id, "Deleted committee role");
      },
      async listAssignments() {
        requireAdmin();
        return [...assignments()].sort((a, b) => a.display_order - b.display_order);
      },
      async saveAssignment(input) {
        requireAdmin();
        const list = assignments();
        const role = roles().find((r) => r.id === input.role_id);
        if (!role) throw new Error("Choose a valid role.");
        if (input.is_active && !role.is_multiple_allowed) {
          const clash = list.find((a) => a.role_id === input.role_id && a.is_active && a.id !== input.id);
          if (clash) throw new Error(`${role.role_name} already has an active person. Deactivate them first.`);
        }
        if (input.id) {
          const existing = list.find((a) => a.id === input.id);
          if (!existing) throw new Error("Assignment not found.");
          const updated: CommitteeAssignment = { ...existing, ...input, id: input.id };
          write(
            K.assignments,
            list.map((a) => (a.id === input.id ? updated : a)),
          );
          await audit("update", "committee", input.id, `Updated ${role.role_name} assignment`);
          return updated;
        }
        const created: CommitteeAssignment = { ...input, id: uid(), created_at: now() };
        write(K.assignments, [...list, created]);
        await audit("create", "committee", created.id, `Assigned ${role.role_name}`);
        return created;
      },
      async deleteAssignment(id) {
        requireAdmin();
        write(
          K.assignments,
          assignments().filter((a) => a.id !== id),
        );
        await audit("delete", "committee", id, "Removed committee assignment");
      },
      async listPublic() {
        const r = roles();
        const m = members();
        return assignments()
          .filter((a) => a.is_active)
          .flatMap((a) => {
            const role = r.find((x) => x.id === a.role_id);
            const member = m.find((x) => x.id === a.member_id);
            if (!role || !member) return [];
            return [
              {
                id: a.id,
                name: member.full_name,
                role_name: role.role_name,
                role_order: role.display_order,
                display_order: a.display_order,
                phone: a.show_phone && a.public_phone ? a.public_phone : null,
                photo_path: a.public_photo_path,
              },
            ];
          })
          .sort((x, y) => x.role_order - y.role_order || x.display_order - y.display_order);
      },
    },

    gallery: {
      async list() {
        requireAdmin();
        return [...gallery()].sort((a, b) => a.display_order - b.display_order);
      },
      async listPublished() {
        return gallery()
          .filter((g) => g.is_published)
          .sort((a, b) => a.display_order - b.display_order);
      },
      async create(input) {
        requireAdmin();
        const item: GalleryItem = { ...input, id: uid(), created_at: now(), is_demo: false };
        write(K.gallery, [...gallery(), item]);
        await audit("create", "gallery", item.id, `Uploaded photo "${item.title}"`);
        return item;
      },
      async update(id, patch) {
        requireAdmin();
        const list = gallery();
        const existing = list.find((g) => g.id === id);
        if (!existing) throw new Error("Photo not found.");
        const updated = { ...existing, ...patch } as GalleryItem;
        write(
          K.gallery,
          list.map((g) => (g.id === id ? updated : g)),
        );
        await audit("update", "gallery", id, `Updated photo "${updated.title}"`);
        return updated;
      },
      async remove(id) {
        requireAdmin();
        const item = gallery().find((g) => g.id === id);
        write(
          K.gallery,
          gallery().filter((g) => g.id !== id),
        );
        if (item && !isDirectUrl(item.image_path)) await provider.files.remove("public-media", item.image_path);
        await audit("delete", "gallery", id, `Deleted photo "${item?.title ?? ""}"`);
      },
      async reorder(orderedIds) {
        requireAdmin();
        const list = gallery();
        write(
          K.gallery,
          list.map((g) => ({ ...g, display_order: orderedIds.indexOf(g.id) + 1 || g.display_order })),
        );
      },
    },

    content: {
      async getSettings() {
        ensureSeeded();
        return { ...DEFAULT_SETTINGS, ...read<Partial<SiteSettings>>(K.settings, {}) };
      },
      async updateSettings(patch) {
        requireAdmin();
        const next = { ...(await provider.content.getSettings()), ...patch };
        write(K.settings, next);
        await audit("update", "settings", "site", `Updated settings: ${Object.keys(patch).join(", ")}`);
        return next;
      },
    },

    files: {
      async upload(bucket, file, filename) {
        requireAdmin();
        const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${bucket}/${uid()}.${ext}`;
        await idbSet(path, file, fileStore());
        return path;
      },
      async getUrl(_bucket: StorageBucket, path: string) {
        if (!path) return null;
        if (isDirectUrl(path)) return path;
        if (!isBrowser()) return null;
        const cached = urlCache.get(path);
        if (cached) return cached;
        const blob = await idbGet<Blob>(path, fileStore());
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urlCache.set(path, url);
        return url;
      },
      async remove(_bucket, path) {
        if (!path || isDirectUrl(path)) return;
        await idbDel(path, fileStore());
        const cached = urlCache.get(path);
        if (cached) URL.revokeObjectURL(cached);
        urlCache.delete(path);
      },
    },

    audit: {
      log: audit,
      async list(limit) {
        requireAdmin();
        return read<AuditLog[]>(K.audit, []).slice(0, limit);
      },
    },

    maintenance: {
      async exportBackup() {
        requireAdmin();
        const files: Record<string, string> = {};
        for (const [key, blob] of await idbEntries<string, Blob>(fileStore())) {
          files[key] = await blobToDataUrl(blob);
        }
        await audit("backup", "system", "-", "Downloaded full backup");
        return {
          app: "htwma",
          version: 1,
          exported_at: now(),
          settings: read(K.settings, DEFAULT_SETTINGS),
          members: members(),
          member_private: privateMap(),
          committee_roles: roles(),
          committee_assignments: assignments(),
          gallery: gallery(),
          fees: fees(),
          audit: read(K.audit, []),
          files,
        };
      },
      async restoreBackup(data) {
        requireAdmin();
        const d = data as Record<string, unknown>;
        if (!d || d["app"] !== "htwma" || !Array.isArray(d["members"])) {
          throw new Error("This file is not a valid HTWMA backup.");
        }
        write(K.settings, d["settings"] ?? DEFAULT_SETTINGS);
        write(K.members, d["members"]);
        write(K.private, d["member_private"] ?? {});
        write(K.roles, d["committee_roles"] ?? []);
        write(K.assignments, d["committee_assignments"] ?? []);
        write(K.gallery, d["gallery"] ?? []);
        write(K.fees, d["fees"] ?? []);
        localStorage.setItem(K.feesSeeded, new Date().toISOString());
        write(K.audit, d["audit"] ?? []);
        const files = (d["files"] ?? {}) as Record<string, string>;
        for (const [key, dataUrl] of Object.entries(files)) {
          const blob = await (await fetch(dataUrl)).blob();
          await idbSet(key, blob, fileStore());
        }
        urlCache.clear();
        await audit("restore", "system", "-", "Restored data from backup");
      },
      async clearDemoData() {
        requireAdmin();
        const demoIds = new Set(members().filter((m) => m.is_demo).map((m) => m.id));
        write(
          K.members,
          members().filter((m) => !m.is_demo),
        );
        const priv = privateMap();
        demoIds.forEach((id) => delete priv[id]);
        write(K.private, priv);
        write(
          K.assignments,
          assignments().filter((a) => !demoIds.has(a.member_id)),
        );
        const feeList = fees();
        const keptFees = feeList.filter((f) => !f.is_demo && !demoIds.has(f.member_id));
        write(K.fees, keptFees);
        const demoPhotos = gallery().filter((g) => g.is_demo).length;
        write(
          K.gallery,
          gallery().filter((g) => !g.is_demo),
        );
        const demoFees = feeList.length - keptFees.length;
        await audit("delete", "system", "-", `Removed ${demoIds.size} demo members, ${demoFees} demo payments and ${demoPhotos} demo photos`);
        return demoIds.size + demoPhotos + demoFees;
      },
    },
  };

  return provider;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
