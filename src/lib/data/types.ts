/**
 * Shared data models for HTWMA. Field names intentionally match the
 * Supabase column names in docs/supabase/schema.sql so either backend
 * can return the same shapes.
 */

export type MemberStatus = "active" | "inactive" | "archived";

export interface Member {
  id: string;
  member_number: string;
  full_name: string;
  garage_name: string;
  photo_path: string | null;
  address: string;
  residence_address: string;
  date_of_birth: string | null; // yyyy-mm-dd
  blood_group: string;
  nominee_name: string;
  mobile: string;
  emergency_contact: string;
  signature_path: string | null;
  status: MemberStatus;
  registration_date: string | null; // yyyy-mm-dd
  consent_given: boolean;
  notes: string;
  /** Last 4 characters only — safe to show in lists. Full values live in MemberSensitive. */
  aadhaar_last4: string;
  pan_last4: string;
  dl_last4: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/** Government ID numbers. Stored separately and only returned on explicit request. */
export interface MemberSensitive {
  aadhaar_number: string;
  pan_number: string;
  driving_licence_number: string;
}

export type MemberInput = Omit<
  Member,
  "id" | "created_at" | "updated_at" | "is_demo" | "aadhaar_last4" | "pan_last4" | "dl_last4"
> & { sensitive: MemberSensitive };

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

/** Only approved public fields — never member records. */
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
  alt_text: string;
  credit: string;
  is_published: boolean;
  display_order: number;
  is_demo: boolean;
  created_at: string;
}

export type GalleryItemInput = Omit<GalleryItem, "id" | "created_at" | "is_demo">;

export const FEE_TYPES = ["Registration", "Annual", "Monthly", "Donation", "Fine", "Other"] as const;
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

export interface SiteUpdate {
  id: string;
  title: string;
  date: string;
  body: string;
}

export type ConfigurableField =
  | "garage_name"
  | "mobile"
  | "date_of_birth"
  | "blood_group"
  | "nominee_name"
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
  updates: SiteUpdate[];
  form_code: string;
  required_fields: ConfigurableField[];
  /** Suggested amount (₹) per fee type, used to prefill the payment form. */
  fee_defaults: Partial<Record<FeeType, number>>;
}

export interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
}

export interface AdminSession {
  user_id: string;
  email: string;
  display_name: string;
  expires_at: string | null;
}

export type StorageBucket = "member-photos" | "member-signatures" | "public-media";
