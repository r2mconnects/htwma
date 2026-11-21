import type { Member, MemberInput, MemberSensitive } from "@/lib/data/types";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Age in whole years from an ISO date (yyyy-mm-dd). Returns null for invalid/future dates. */
export function computeAge(dob: string | null, today: Date = new Date()): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) return null;
  if (birth > today) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() < mo - 1 || (today.getMonth() === mo - 1 && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Strips spaces/dashes and a leading +91 / 0, returning the 10-digit number. */
export function normalizePhone(value: string): string {
  let v = value.replace(/[\s\-().]/g, "");
  if (v.startsWith("+91")) v = v.slice(3);
  else if (v.length === 12 && v.startsWith("91")) v = v.slice(2);
  else if (v.length === 11 && v.startsWith("0")) v = v.slice(1);
  return v;
}

export function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(value));
}

export function normalizeAadhaar(value: string): string {
  return value.replace(/\s|-/g, "");
}
export function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(normalizeAadhaar(value));
}
export function isValidPan(value: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(value.trim().toUpperCase());
}
export function isValidDrivingLicence(value: string): boolean {
  const v = value.replace(/[\s-]/g, "");
  return /^[A-Za-z0-9]{8,20}$/.test(v);
}

export function last4(value: string): string {
  const v = value.replace(/[\s-]/g, "");
  return v.length >= 4 ? v.slice(-4) : v;
}

export function maskId(last: string, kind: "aadhaar" | "pan" | "dl"): string {
  if (!last) return "—";
  if (kind === "aadhaar") return `XXXX XXXX ${last}`;
  return `••••••${last}`;
}

/** Normalises member numbers so "007", "7" and " 7 " count as the same ID. */
export function normalizeMemberNumber(value: string): string {
  const v = value.trim().toUpperCase();
  return /^\d+$/.test(v) ? String(Number(v)) : v;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function sensitiveLast4(s: MemberSensitive) {
  return {
    aadhaar_last4: s.aadhaar_number ? last4(s.aadhaar_number) : "",
    pan_last4: s.pan_number ? last4(s.pan_number) : "",
    dl_last4: s.driving_licence_number ? last4(s.driving_licence_number) : "",
  };
}

export function emptyMemberInput(): MemberInput {
  return {
    member_number: "",
    full_name: "",
    garage_name: "",
    photo_path: null,
    address: "",
    residence_address: "",
    date_of_birth: null,
    blood_group: "",
    nominee_name: "",
    mobile: "",
    emergency_contact: "",
    signature_path: null,
    status: "active",
    registration_date: new Date().toISOString().slice(0, 10),
    consent_given: false,
    notes: "",
    sensitive: { aadhaar_number: "", pan_number: "", driving_licence_number: "" },
  };
}

export function memberToInput(m: Member, sensitive: MemberSensitive): MemberInput {
  return {
    member_number: m.member_number,
    full_name: m.full_name,
    garage_name: m.garage_name,
    photo_path: m.photo_path,
    address: m.address,
    residence_address: m.residence_address,
    date_of_birth: m.date_of_birth,
    blood_group: m.blood_group,
    nominee_name: m.nominee_name,
    mobile: m.mobile,
    emergency_contact: m.emergency_contact,
    signature_path: m.signature_path,
    status: m.status,
    registration_date: m.registration_date,
    consent_given: m.consent_given,
    notes: m.notes,
    sensitive,
  };
}

/** Sort member numbers naturally: 2 before 10, numeric before text. */
export function compareMemberNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
