/**
 * Domain models mapped directly to the Supabase PostgreSQL schema in
 * supabase/migrations/ (and docs/supabase/schema.sql).
 */

export type MemberStatus = "active" | "inactive" | "archived";
export type AdminRole = "super_admin" | "admin" | "editor" | "viewer";

export interface Member {
  id: string;
  member_number: string;
  registration_number: string;
  full_name: string;
  garage_name: string;
  photo_path: string | null;
  address: string;
  residence_address: string;
  date_of_birth: string | null; // yyyy-mm-dd
  blood_group: string;
  nominee_name: string;
  nominee_age: number | null;
  mobile: string;
  whatsapp_number: string;
  emergency_contact: string;
  signature_path: string | null;
  status: MemberStatus;
  registration_date: string | null; // yyyy-mm-dd
  consent_given: boolean;
  notes: string;
  /** Last 4 characters only — safe to show in admin lists. Full values live in member_documents. */
  aadhaar_last4: string;
  pan_last4: string;
  dl_last4: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/** Private identity documents stored in public.member_documents and private member-documents storage. */
export interface MemberSensitive {
  aadhaar_number: string;
  pan_number: string;
  driving_licence_number: string;
  aadhaar_doc_path: string | null;
  pan_doc_path: string | null;
  dl_doc_path: string | null;
  other_doc_path: string | null;
  other_doc_label: string;
  notes: string;
}

export interface InitialMemberFeeInput {
  amount: number;
  fee_type: FeeType;
  payment_mode: PaymentMode;
  paid_on: string;
  period: string;
  notes?: string | undefined;
}

export type MemberInput = Omit<
  Member,
  "id" | "created_at" | "updated_at" | "is_demo" | "aadhaar_last4" | "pan_last4" | "dl_last4"
> & {
  sensitive: MemberSensitive;
  initial_fees?: InitialMemberFeeInput[] | undefined;
};

export interface CommitteeRole {
  id: string;
  role_name: string;
  display_order: number;
  is_multiple_allowed: boolean;
}

export interface CommitteeAssignment {
  id: string;
  member_id: string;
  role_id: string;
  term_start: string | null;
  term_end: string | null;
  public_phone: string;
  show_phone: boolean;
  public_photo_path: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export type CommitteeAssignmentInput = Omit<CommitteeAssignment, "id" | "created_at">;

/** Only approved public fields — never private member records. */
export interface PublicCommitteeEntry {
  id: string;
  name: string;
  role_name: string;
  role_order: number;
  display_order: number;
  phone: string | null;
  photo_path: string | null;
}

export type GalleryCategory = "Office" | "Meetings" | "Events" | "Activities" | "Other";
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  "Office",
  "Meetings",
  "Events",
  "Activities",
  "Other",
];

export interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  event_date: string | null;
  uploaded_at: string;
  alt_text: string;
  credit: string;
  is_published: boolean;
  display_order: number;
  is_demo: boolean;
  created_at: string;
}

export type GalleryItemInput = Omit<GalleryItem, "id" | "created_at" | "uploaded_at" | "is_demo">;

export const ANNOUNCEMENT_CATEGORIES = [
  "Notice",
  "Meeting",
  "Event",
  "Welfare",
  "General",
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  published_date: string; // yyyy-mm-dd
  is_published: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type AnnouncementInput = Omit<Announcement, "id" | "created_at" | "updated_at">;

export const CONTACT_MESSAGE_STATUSES = ["unread", "read", "replied", "archived"] as const;
export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];

export interface ContactMessage {
  id: string;
  sender_name: string;
  sender_phone: string;
  sender_email: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMessageSubmitInput {
  sender_name: string;
  sender_phone?: string | undefined;
  sender_email?: string | undefined;
  subject?: string | undefined;
  message: string;
}

export const FEE_TYPES = [
  "Registration",
  "Annual",
  "Monthly",
  "Donation",
  "Fine",
  "Other",
] as const;
export type FeeType = (typeof FEE_TYPES)[number];
export const PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Cheque"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface FeePayment {
  id: string;
  member_id: string;
  amount: number; // whole rupees
  fee_type: FeeType;
  payment_mode: PaymentMode;
  paid_on: string; // yyyy-mm-dd
  /** "2026" for annual fees, "2026-11" for monthly, free text otherwise. */
  period: string;
  receipt_number: string;
  notes: string;
  is_demo: boolean;
  created_at: string;
}

export type FeePaymentInput = Omit<FeePayment, "id" | "created_at" | "is_demo">;

export type ConfigurableField =
  | "garage_name"
  | "mobile"
  | "date_of_birth"
  | "blood_group"
  | "nominee_name"
  | "nominee_age"
  | "emergency_contact"
  | "address"
  | "residence_address"
  | "aadhaar_number"
  | "pan_number"
  | "driving_licence_number"
  | "photo";

export interface SiteSettings {
  association_name: string;
  short_name: string;
  tagline: string;
  logo_path: string | null;
  location_label: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  office_hours: string;
  map_url: string;
  facebook_url: string;
  youtube_url: string;
  x_url: string;
  home_intro: string;
  about_intro: string;
  mission: string;
  vision: string;
  history: string;
  activities: string; // one per line
  form_code: string;
  required_fields: ConfigurableField[];
  /** Suggested amount (₹) per fee type, used to prefill the payment form. */
  fee_defaults: Partial<Record<FeeType, number>>;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminSession {
  user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  expires_at: string | null;
}

export type StorageBucket =
  "member-photos" | "member-documents" | "member-signatures" | "public-media";
