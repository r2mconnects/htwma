import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createSupabaseProvider } from "@/lib/data/supabase/supabase-provider";
import { emptyMemberInput, normalizeMemberNumber, sensitiveLast4 } from "@/lib/members";

/**
 * Stateful in-memory mock of Supabase Client (Auth + PostgREST + RPC + Storage)
 * mirroring the live PostgreSQL triggers, RPCs, and RLS admin checks on szxfrbrppkofeoojzewq.
 */
function createMockSupabaseClient() {
  let currentUser: { id: string; email: string } | null = null;
  let memberSeq = 0;
  let feeSeq = 0;

  const adminUsers = new Map<string, Database["public"]["Tables"]["admin_users"]["Row"]>([
    [
      "00000000-0000-4000-8000-000000000001",
      {
        id: "00000000-0000-4000-8000-000000000001",
        email: "htwma@gmail.com",
        display_name: "HTWMA Office Admin",
        role: "super_admin",
        permissions: {},
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  ]);

  const validPasswords = new Map<string, string>([
    ["htwma@gmail.com", "TestAdmin#2026"],
    ["visitor@example.com", "VisitorPass#123"],
  ]);

  const members = new Map<string, Database["public"]["Tables"]["members"]["Row"]>();
  const docs = new Map<string, Database["public"]["Tables"]["member_documents"]["Row"]>();
  const fees = new Map<string, Database["public"]["Tables"]["member_fees"]["Row"]>();
  const logs: Database["public"]["Tables"]["activity_logs"]["Row"][] = [];
  const announcements = new Map<string, Database["public"]["Tables"]["announcements"]["Row"]>();
  const messages = new Map<string, Database["public"]["Tables"]["contact_messages"]["Row"]>();
  const storageObjects = new Map<string, Set<string>>([
    ["member-photos", new Set()],
    ["member-documents", new Set()],
    ["member-signatures", new Set()],
    ["public-media", new Set()],
  ]);

  function requireActiveAdmin() {
    if (!currentUser) throw new Error("Administrator privileges required.");
    const adm = adminUsers.get(currentUser.id);
    if (!adm || !adm.is_active) throw new Error("Administrator privileges required.");
  }

  function makeQueryBuilder(table: string) {
    const state: {
      op: "select" | "insert" | "update" | "delete";
      payload?: Record<string, unknown>;
      filters: Array<(r: Record<string, unknown>) => boolean>;
      singleMode?: "single" | "maybeSingle";
      rangeBounds?: [number, number];
      limitCount?: number;
    } = { op: "select", filters: [] };

    const getTableRows = (): Record<string, unknown>[] => {
      switch (table) {
        case "admin_users":
          return [...adminUsers.values()] as unknown as Record<string, unknown>[];
        case "members":
          return [...members.values()] as unknown as Record<string, unknown>[];
        case "member_documents":
          return [...docs.values()] as unknown as Record<string, unknown>[];
        case "member_fees":
          return [...fees.values()] as unknown as Record<string, unknown>[];
        case "activity_logs":
          return [...logs] as unknown as Record<string, unknown>[];
        case "announcements":
          return [...announcements.values()] as unknown as Record<string, unknown>[];
        case "contact_messages":
          return [...messages.values()] as unknown as Record<string, unknown>[];
        default:
          return [];
      }
    };

    const execute = async () => {
      try {
        if (state.op === "insert") {
          const row = { ...(state.payload ?? {}) };
          if (table === "activity_logs") {
            requireActiveAdmin();
            const entry = {
              id: crypto.randomUUID(),
              admin_id: (row["admin_id"] as string) ?? currentUser?.id ?? null,
              admin_email: (row["admin_email"] as string) ?? currentUser?.email ?? "",
              action: String(row["action"] ?? ""),
              entity_type: String(row["entity_type"] ?? ""),
              entity_id: String(row["entity_id"] ?? ""),
              summary: String(row["summary"] ?? ""),
              metadata: {},
              created_at: new Date().toISOString(),
            };
            logs.unshift(entry);
            return { data: state.singleMode ? entry : [entry], error: null };
          }
          if (table === "member_fees") {
            requireActiveAdmin();
            const receipt =
              String(row["receipt_number"] ?? "").trim() ||
              `R-${String(++feeSeq).padStart(4, "0")}`;
            for (const f of fees.values()) {
              if (f.receipt_number === receipt) {
                return { data: null, error: { code: "23505", message: "Duplicate receipt" } };
              }
            }
            const saved: Database["public"]["Tables"]["member_fees"]["Row"] = {
              id: crypto.randomUUID(),
              member_id: String(row["member_id"]),
              amount: Number(row["amount"]),
              fee_type: row[
                "fee_type"
              ] as Database["public"]["Tables"]["member_fees"]["Row"]["fee_type"],
              payment_mode: row[
                "payment_mode"
              ] as Database["public"]["Tables"]["member_fees"]["Row"]["payment_mode"],
              paid_on: String(row["paid_on"]),
              period: String(row["period"] ?? ""),
              receipt_number: receipt,
              notes: String(row["notes"] ?? ""),
              is_demo: false,
              recorded_by: currentUser?.id ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            fees.set(saved.id, saved);
            return { data: state.singleMode ? saved : [saved], error: null };
          }
          if (table === "announcements") {
            requireActiveAdmin();
            const saved: Database["public"]["Tables"]["announcements"]["Row"] = {
              id: crypto.randomUUID(),
              title: String(row["title"]),
              body: String(row["body"]),
              category:
                (row[
                  "category"
                ] as Database["public"]["Tables"]["announcements"]["Row"]["category"]) ?? "Notice",
              published_date: String(row["published_date"]),
              is_published: Boolean(row["is_published"]),
              is_pinned: Boolean(row["is_pinned"]),
              created_by: currentUser?.id ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            announcements.set(saved.id, saved);
            return { data: state.singleMode ? saved : [saved], error: null };
          }
        }

        if (state.op === "update") {
          requireActiveAdmin();
          const matched = getTableRows().filter((r) => state.filters.every((fn) => fn(r)));
          const updated: Record<string, unknown>[] = [];
          for (const item of matched) {
            const next: Record<string, unknown> = {
              ...item,
              ...(state.payload ?? {}),
              updated_at: new Date().toISOString(),
            };
            const nextId = String(next["id"] ?? "");
            if (table === "members")
              members.set(
                nextId,
                next as unknown as Database["public"]["Tables"]["members"]["Row"],
              );
            if (table === "admin_users")
              adminUsers.set(
                nextId,
                next as unknown as Database["public"]["Tables"]["admin_users"]["Row"],
              );
            if (table === "announcements")
              announcements.set(
                nextId,
                next as unknown as Database["public"]["Tables"]["announcements"]["Row"],
              );
            if (table === "contact_messages")
              messages.set(
                nextId,
                next as unknown as Database["public"]["Tables"]["contact_messages"]["Row"],
              );
            updated.push(next);
          }
          return { data: state.singleMode ? (updated[0] ?? null) : updated, error: null };
        }

        if (state.op === "delete") {
          requireActiveAdmin();
          const matched = getTableRows().filter((r) => state.filters.every((fn) => fn(r)));
          for (const item of matched) {
            if (table === "member_fees") fees.delete(String(item["id"]));
            if (table === "announcements") announcements.delete(String(item["id"]));
            if (table === "contact_messages") messages.delete(String(item["id"]));
          }
          return { data: matched, error: null };
        }

        // SELECT
        if (table !== "announcements") requireActiveAdmin();
        let rows = getTableRows().filter((r) => state.filters.every((fn) => fn(r)));
        if (state.rangeBounds) rows = rows.slice(state.rangeBounds[0], state.rangeBounds[1] + 1);
        if (state.limitCount !== undefined) rows = rows.slice(0, state.limitCount);
        if (state.singleMode === "single")
          return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Not found" } };
        if (state.singleMode === "maybeSingle") return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : "Query error" } };
      }
    };

    const builder = {
      select: () => builder,
      insert: (payload: Record<string, unknown>) => {
        state.op = "insert";
        state.payload = payload;
        return builder;
      },
      update: (payload: Record<string, unknown>) => {
        state.op = "update";
        state.payload = payload;
        return builder;
      },
      delete: () => {
        state.op = "delete";
        return builder;
      },
      eq: (col: string, val: unknown) => {
        state.filters.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: unknown) => {
        state.filters.push((r) => r[col] !== val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        state.filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      order: () => builder,
      range: (from: number, to: number) => {
        state.rangeBounds = [from, to];
        return builder;
      },
      limit: (n: number) => {
        state.limitCount = n;
        return builder;
      },
      single: () => {
        state.singleMode = "single";
        return execute();
      },
      maybeSingle: () => {
        state.singleMode = "maybeSingle";
        return execute();
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        execute().then(onFulfilled, onRejected),
    };
    return builder;
  }

  const mock = {
    auth: {
      getSession: async () => ({
        data: {
          session: currentUser
            ? { user: currentUser, expires_at: Math.floor(Date.now() / 1000) + 3600 }
            : null,
        },
      }),
      getUser: async () => ({ data: { user: currentUser } }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const expected = validPasswords.get(email.toLowerCase());
        if (!expected || expected !== password) {
          return {
            data: { user: null, session: null },
            error: { message: "Invalid login credentials" },
          };
        }
        currentUser =
          email.toLowerCase() === "htwma@gmail.com"
            ? { id: "00000000-0000-4000-8000-000000000001", email: "htwma@gmail.com" }
            : { id: "00000000-0000-4000-8000-000000000099", email: email.toLowerCase() };
        return { data: { user: currentUser }, error: null };
      },
      signOut: async () => {
        currentUser = null;
        return { error: null };
      },
      updateUser: async ({ password }: { password: string }) => {
        if (currentUser) validPasswords.set(currentUser.email, password);
        return { data: { user: currentUser }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
    from: (table: string) => makeQueryBuilder(table),
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      try {
        if (fn === "has_role") {
          const uid = String(args["_user_id"] ?? "");
          const adm = adminUsers.get(uid);
          return { data: Boolean(adm && adm.is_active), error: null };
        }
        if (fn === "peek_next_member_number") {
          requireActiveAdmin();
          return { data: String(memberSeq + 1).padStart(3, "0"), error: null };
        }
        if (fn === "upsert_member_with_documents") {
          requireActiveAdmin();
          const memberId = (args["p_member_id"] as string | null) ?? null;
          const p = (args["p_payload"] ?? {}) as Record<string, unknown>;
          const rawNum =
            String(p["member_number"] ?? "").trim() || String(++memberSeq).padStart(3, "0");
          if (/^\d+$/.test(rawNum) && Number(rawNum) > memberSeq) memberSeq = Number(rawNum);
          const norm = normalizeMemberNumber(rawNum);
          for (const existing of members.values()) {
            if (existing.normalized_member_number === norm && existing.id !== memberId) {
              return { data: null, error: { code: "23505", message: "Duplicate member_number" } };
            }
          }
          const docPayload = (p["documents"] ?? {}) as Record<string, unknown>;
          const masks = sensitiveLast4({
            aadhaar_number: String(docPayload["aadhaar_number"] ?? ""),
            pan_number: String(docPayload["pan_number"] ?? ""),
            driving_licence_number: String(docPayload["driving_licence_number"] ?? ""),
          });
          const id = memberId ?? crypto.randomUUID();
          const savedMember: Database["public"]["Tables"]["members"]["Row"] = {
            id,
            member_number: rawNum,
            normalized_member_number: norm,
            registration_number: String(p["registration_number"] ?? "") || `HTWMA-${rawNum}`,
            full_name: String(p["full_name"] ?? ""),
            garage_name: String(p["garage_name"] ?? ""),
            photo_path: (p["photo_path"] as string | null) ?? null,
            signature_path: (p["signature_path"] as string | null) ?? null,
            address: String(p["address"] ?? ""),
            residence_address: String(p["residence_address"] ?? ""),
            date_of_birth: String(p["date_of_birth"] ?? "") || null,
            blood_group: String(p["blood_group"] ?? ""),
            nominee_name: String(p["nominee_name"] ?? ""),
            nominee_age: String(p["nominee_age"] ?? "") ? Number(p["nominee_age"]) : null,
            mobile: String(p["mobile"] ?? ""),
            whatsapp_number: String(p["whatsapp_number"] ?? ""),
            emergency_contact: String(p["emergency_contact"] ?? ""),
            aadhaar_last4: masks.aadhaar_last4,
            pan_last4: masks.pan_last4,
            dl_last4: masks.dl_last4,
            status:
              (p["status"] as Database["public"]["Tables"]["members"]["Row"]["status"]) ?? "active",
            registration_date: String(p["registration_date"] ?? "") || null,
            consent_given: Boolean(p["consent_given"]),
            notes: String(p["notes"] ?? ""),
            is_demo: false,
            created_by: currentUser?.id ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          members.set(id, savedMember);
          docs.set(id, {
            id: crypto.randomUUID(),
            member_id: id,
            aadhaar_number: String(docPayload["aadhaar_number"] ?? ""),
            pan_number: String(docPayload["pan_number"] ?? ""),
            driving_licence_number: String(docPayload["driving_licence_number"] ?? ""),
            aadhaar_doc_path: (docPayload["aadhaar_doc_path"] as string | null) ?? null,
            pan_doc_path: (docPayload["pan_doc_path"] as string | null) ?? null,
            dl_doc_path: (docPayload["dl_doc_path"] as string | null) ?? null,
            other_doc_path: (docPayload["other_doc_path"] as string | null) ?? null,
            other_doc_label: String(docPayload["other_doc_label"] ?? ""),
            notes: String(docPayload["notes"] ?? ""),
            updated_by: currentUser?.id ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          logs.unshift({
            id: crypto.randomUUID(),
            admin_id: currentUser?.id ?? null,
            admin_email: currentUser?.email ?? "",
            action: memberId ? "update" : "create",
            entity_type: "member",
            entity_id: id,
            summary: `${memberId ? "Updated" : "Registered"} member #${rawNum} ${savedMember.full_name}`,
            metadata: {},
            created_at: new Date().toISOString(),
          });
          return { data: savedMember, error: null };
        }
        if (fn === "delete_member_permanently") {
          requireActiveAdmin();
          const id = String(args["p_member_id"]);
          const m = members.get(id);
          if (!m) return { data: null, error: { message: "Member not found." } };
          if (m.status !== "archived")
            return {
              data: null,
              error: { message: "Archive the member before permanently deleting." },
            };
          const d = docs.get(id);
          members.delete(id);
          docs.delete(id);
          return {
            data: {
              photo_path: m.photo_path,
              signature_path: m.signature_path,
              aadhaar_doc_path: d?.aadhaar_doc_path ?? null,
              pan_doc_path: d?.pan_doc_path ?? null,
              dl_doc_path: d?.dl_doc_path ?? null,
              other_doc_path: d?.other_doc_path ?? null,
            },
            error: null,
          };
        }
        if (fn === "submit_contact_message") {
          const id = crypto.randomUUID();
          messages.set(id, {
            id,
            sender_name: String(args["p_sender_name"]),
            sender_phone: String(args["p_sender_phone"] ?? ""),
            sender_email: String(args["p_sender_email"] ?? ""),
            subject: String(args["p_subject"] ?? ""),
            message: String(args["p_message"]),
            status: "unread",
            admin_notes: "",
            replied_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return { data: id, error: null };
        }
        return { data: null, error: { message: `Unhandled RPC ${fn}` } };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : "RPC error" } };
      }
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          requireActiveAdmin();
          storageObjects.get(bucket)?.add(path);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
        createSignedUrl: async (path: string) => ({
          data: {
            signedUrl: `https://example.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=1`,
          },
          error: null,
        }),
        remove: async (paths: string[]) => {
          for (const p of paths) storageObjects.get(bucket)?.delete(p);
          return { data: [], error: null };
        },
      }),
    },
  };

  return {
    client: mock as unknown as SupabaseClient<Database>,
    storageObjects,
  };
}

describe("Supabase PostgreSQL DataProvider", () => {
  it("authenticates an authorised admin and rejects wrong passwords or non-admin users", async () => {
    const { client } = createMockSupabaseClient();
    const db = createSupabaseProvider("https://szxfrbrppkofeoojzewq.supabase.co", "anon", client);

    await expect(db.auth.signIn("htwma@gmail.com", "wrong-password")).rejects.toThrow(
      "Incorrect email or password.",
    );
    await expect(db.auth.signIn("visitor@example.com", "VisitorPass#123")).rejects.toThrow(
      "This account is not an authorised HTWMA administrator.",
    );

    const session = await db.auth.signIn("HTWMA@gmail.com", "TestAdmin#2026");
    expect(session.email).toBe("htwma@gmail.com");
    expect(session.role).toBe("super_admin");
    expect(await db.auth.getSession()).not.toBeNull();
  });

  it("creates members atomically with masked sensitive IDs, enforces archive-before-delete, and cleans up private storage", async () => {
    const { client, storageObjects } = createMockSupabaseClient();
    const db = createSupabaseProvider("https://szxfrbrppkofeoojzewq.supabase.co", "anon", client);
    await db.auth.signIn("htwma@gmail.com", "TestAdmin#2026");

    expect(await db.members.peekNextNumber()).toBe("001");

    const docPath = await db.files.upload(
      "member-documents",
      new Blob(["pdf"], { type: "application/pdf" }),
      "aadhaar.pdf",
    );
    expect(storageObjects.get("member-documents")?.has(docPath)).toBe(true);

    const created = await db.members.create({
      ...emptyMemberInput(),
      member_number: "001",
      full_name: "Narasimha Rao",
      garage_name: "Sri Lakshmi Two Wheeler Works",
      nominee_name: "Padmavathi",
      nominee_age: 38,
      mobile: "+91 98490 12345",
      sensitive: {
        aadhaar_number: "9876 5432 1098",
        pan_number: "abcde1234f",
        driving_licence_number: "AP02 20180012345",
        aadhaar_doc_path: docPath,
        pan_doc_path: null,
        dl_doc_path: null,
        other_doc_path: null,
        other_doc_label: "",
        notes: "",
      },
    });

    expect(created.aadhaar_last4).toBe("1098");
    expect(created.pan_last4).toBe("234F");
    expect(created.registration_number).toBe("HTWMA-001");
    expect(created.mobile).toBe("9849012345");
    expect(await db.members.isNumberTaken("1", null)).toBe(true);
    expect(await db.members.peekNextNumber()).toBe("002");

    // Sensitive IDs stored separately in member_documents
    const fullSensitive = await db.members.getSensitive(created.id);
    expect(fullSensitive.aadhaar_number).toBe("987654321098");
    expect(fullSensitive.pan_number).toBe("ABCDE1234F");
    expect(fullSensitive.aadhaar_doc_path).toBe(docPath);

    // Cannot permanently delete an active member before archiving
    await expect(db.members.remove(created.id)).rejects.toThrow(
      "Archive the member before permanently deleting.",
    );

    await db.members.setStatus(created.id, "archived");
    await db.members.remove(created.id);
    expect(storageObjects.get("member-documents")?.has(docPath)).toBe(false);
  });

  it("allows public contact submissions and admin management of fees, announcements, messages, and activity logs", async () => {
    const { client } = createMockSupabaseClient();
    const db = createSupabaseProvider("https://szxfrbrppkofeoojzewq.supabase.co", "anon", client);

    // Public visitor submits contact message before signing in
    const msgId = await db.messages.submit({
      sender_name: "Ramesh Mechanic",
      sender_phone: "9440112233",
      subject: "Membership",
      message: "How can I register my garage near Parigi Bus Stand?",
    });
    expect(msgId).toBeTruthy();

    // Unauthenticated user cannot list contact messages
    await expect(db.messages.list()).rejects.toThrow("Administrator privileges required.");

    // Sign in as admin to manage messages, announcements, and fees
    await db.auth.signIn("htwma@gmail.com", "TestAdmin#2026");
    const inbox = await db.messages.list();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.sender_name).toBe("Ramesh Mechanic");

    const notice = await db.announcements.create({
      title: "General Body Meeting",
      body: "Sunday 10 AM at Hindupur Association Hall.",
      category: "Meeting",
      published_date: "2026-11-24",
      is_published: true,
      is_pinned: true,
    });
    expect(notice.title).toBe("General Body Meeting");

    const member = await db.members.create({
      ...emptyMemberInput(),
      member_number: "010",
      full_name: "K. Sreenivasulu",
    });
    const fee = await db.fees.create({
      member_id: member.id,
      amount: 199,
      fee_type: "Annual",
      payment_mode: "UPI",
      paid_on: "2026-11-24",
      period: "2026",
      receipt_number: "",
      notes: "",
    });
    expect(fee.receipt_number).toMatch(/^R-\d{4}$/);

    const logs = await db.audit.list(10);
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });
});
