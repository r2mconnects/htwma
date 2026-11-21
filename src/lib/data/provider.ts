import type {
  AdminSession,
  AuditLog,
  CommitteeAssignment,
  CommitteeAssignmentInput,
  CommitteeRole,
  GalleryItem,
  GalleryItemInput,
  Member,
  MemberInput,
  MemberSensitive,
  MemberStatus,
  PublicCommitteeEntry,
  SiteSettings,
  StorageBucket,
} from "./types";

/**
 * The ONLY contract the UI talks to. Implementations:
 *  - local/local-provider.ts    → browser localStorage + IndexedDB (default, works offline)
 *  - supabase/supabase-provider.ts → your Supabase project (set VITE_DATA_BACKEND=supabase)
 * Swap backends in src/lib/data/index.ts without touching any page.
 */
export interface DataProvider {
  kind: "local" | "supabase";

  auth: {
    getSession(): Promise<AdminSession | null>;
    /** True when no admin exists yet (local mode first run). */
    needsSetup(): Promise<boolean>;
    setupFirstAdmin(input: { email: string; password: string; display_name: string }): Promise<AdminSession>;
    signIn(email: string, password: string): Promise<AdminSession>;
    signOut(): Promise<void>;
    verifyPassword(password: string): Promise<boolean>;
    changePassword(current: string, next: string): Promise<void>;
    requestPasswordReset(email: string): Promise<void>;
  };

  members: {
    list(): Promise<Member[]>;
    get(id: string): Promise<Member | null>;
    getSensitive(id: string): Promise<MemberSensitive>;
    /** Full ID numbers for many members — only for elevated exports. */
    getSensitiveMany(ids: string[]): Promise<Record<string, MemberSensitive>>;
    create(input: MemberInput): Promise<Member>;
    update(id: string, input: MemberInput): Promise<Member>;
    setStatus(id: string, status: MemberStatus): Promise<void>;
    remove(id: string): Promise<void>;
    isNumberTaken(memberNumber: string, excludeId: string | null): Promise<boolean>;
    bulkCreate(inputs: MemberInput[]): Promise<number>;
  };

  committee: {
    listRoles(): Promise<CommitteeRole[]>;
    saveRole(role: Omit<CommitteeRole, "id"> & { id: string | null }): Promise<CommitteeRole>;
    deleteRole(id: string): Promise<void>;
    listAssignments(): Promise<CommitteeAssignment[]>;
    saveAssignment(input: CommitteeAssignmentInput & { id: string | null }): Promise<CommitteeAssignment>;
    deleteAssignment(id: string): Promise<void>;
    listPublic(): Promise<PublicCommitteeEntry[]>;
  };

  gallery: {
    list(): Promise<GalleryItem[]>;
    listPublished(): Promise<GalleryItem[]>;
    create(input: GalleryItemInput): Promise<GalleryItem>;
    update(id: string, input: Partial<GalleryItemInput>): Promise<GalleryItem>;
    remove(id: string): Promise<void>;
    reorder(orderedIds: string[]): Promise<void>;
  };

  content: {
    getSettings(): Promise<SiteSettings>;
    updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings>;
  };

  files: {
    upload(bucket: StorageBucket, file: Blob, filename: string): Promise<string>;
    /** Resolves a stored path to a displayable URL (object URL / signed URL / public URL). */
    getUrl(bucket: StorageBucket, path: string): Promise<string | null>;
    remove(bucket: StorageBucket, path: string): Promise<void>;
  };

  audit: {
    log(action: string, entityType: string, entityId: string, summary: string): Promise<void>;
    list(limit: number): Promise<AuditLog[]>;
  };

  /** Backup/restore + demo data tools. */
  maintenance: {
    exportBackup(): Promise<unknown>;
    restoreBackup(data: unknown): Promise<void>;
    clearDemoData(): Promise<number>;
  };
}

/** Paths that are already URLs (seeded/bundled images) bypass storage. */
export function isDirectUrl(path: string): boolean {
  return /^(https?:|\/|data:|blob:)/.test(path);
}
