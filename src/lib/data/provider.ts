import type {
  AdminSession,
  AdminUserRecord,
  Announcement,
  AnnouncementInput,
  AuditLog,
  CommitteeAssignment,
  CommitteeAssignmentInput,
  CommitteeRole,
  ContactMessage,
  ContactMessageStatus,
  ContactMessageSubmitInput,
  FeePayment,
  FeePaymentInput,
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
 * Supabase PostgreSQL data service contract for the HTWMA Member Hub.
 */
export interface DataProvider {
  kind: "supabase";

  auth: {
    getSession(): Promise<AdminSession | null>;
    signIn(email: string, password: string): Promise<AdminSession>;
    signOut(): Promise<void>;
    verifyPassword(password: string): Promise<boolean>;
    changePassword(current: string, next: string): Promise<void>;
    requestPasswordReset(email: string): Promise<void>;
    listAdmins(): Promise<AdminUserRecord[]>;
  };

  members: {
    list(): Promise<Member[]>;
    get(id: string): Promise<Member | null>;
    peekNextNumber(): Promise<string>;
    getSensitive(id: string): Promise<MemberSensitive>;
    /** Full ID numbers for many members — only for password-verified admin exports. */
    getSensitiveMany(ids: string[]): Promise<Record<string, MemberSensitive>>;
    create(input: MemberInput): Promise<Member>;
    update(id: string, input: MemberInput): Promise<Member>;
    setStatus(id: string, status: MemberStatus): Promise<void>;
    remove(id: string): Promise<void>;
    isNumberTaken(memberNumber: string, excludeId: string | null): Promise<boolean>;
    bulkCreate(inputs: MemberInput[]): Promise<number>;
  };

  fees: {
    list(): Promise<FeePayment[]>;
    /** Leave receipt_number blank to auto-number atomically via member_sequences (R-0001, R-0002…). */
    create(input: FeePaymentInput): Promise<FeePayment>;
    update(id: string, input: FeePaymentInput): Promise<FeePayment>;
    remove(id: string): Promise<void>;
  };

  committee: {
    listRoles(): Promise<CommitteeRole[]>;
    saveRole(role: Omit<CommitteeRole, "id"> & { id: string | null }): Promise<CommitteeRole>;
    deleteRole(id: string): Promise<void>;
    listAssignments(): Promise<CommitteeAssignment[]>;
    saveAssignment(
      input: CommitteeAssignmentInput & { id: string | null },
    ): Promise<CommitteeAssignment>;
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

  announcements: {
    list(): Promise<Announcement[]>;
    listPublished(): Promise<Announcement[]>;
    create(input: AnnouncementInput): Promise<Announcement>;
    update(id: string, patch: Partial<AnnouncementInput>): Promise<Announcement>;
    remove(id: string): Promise<void>;
  };

  messages: {
    submit(input: ContactMessageSubmitInput): Promise<string>;
    list(): Promise<ContactMessage[]>;
    update(
      id: string,
      patch: { status?: ContactMessageStatus | undefined; admin_notes?: string | undefined },
    ): Promise<ContactMessage>;
    remove(id: string): Promise<void>;
  };

  content: {
    getSettings(): Promise<SiteSettings>;
    updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings>;
  };

  files: {
    upload(bucket: StorageBucket, file: Blob, filename: string): Promise<string>;
    /** Resolves a stored path to a displayable URL (short-lived signed URL for private buckets, public URL for public-media). */
    getUrl(bucket: StorageBucket, path: string): Promise<string | null>;
    remove(bucket: StorageBucket, path: string): Promise<void>;
  };

  audit: {
    log(action: string, entityType: string, entityId: string, summary: string): Promise<void>;
    list(limit: number): Promise<AuditLog[]>;
  };

  maintenance: {
    exportBackup(): Promise<unknown>;
    clearDemoData(): Promise<number>;
  };
}

/** Paths that are already URLs bypass storage lookup. */
export function isDirectUrl(path: string): boolean {
  return /^(https?:|\/|data:|blob:)/.test(path);
}
