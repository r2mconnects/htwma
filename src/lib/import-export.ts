import { EMPTY_SENSITIVE } from "@/lib/data/defaults";
import type { Member, MemberInput, MemberSensitive, MemberStatus } from "@/lib/data/types";
import {
  computeAge,
  formatDate,
  isValidAadhaar,
  isValidDrivingLicence,
  isValidIndianMobile,
  isValidPan,
  normalizeMemberNumber,
  normalizePhone,
  BLOOD_GROUPS,
} from "@/lib/members";

export type MemberColumnKey =
  | "member_number"
  | "registration_number"
  | "full_name"
  | "garage_name"
  | "mobile"
  | "emergency_contact"
  | "date_of_birth"
  | "age"
  | "blood_group"
  | "nominee_name"
  | "nominee_age"
  | "address"
  | "residence_address"
  | "status"
  | "registration_date"
  | "notes"
  | "aadhaar_number"
  | "pan_number"
  | "driving_licence_number";

export interface ColumnDef {
  key: MemberColumnKey;
  label: string;
  sensitive: boolean;
  importable: boolean;
  synonyms: string[];
}

export const MEMBER_COLUMNS: ColumnDef[] = [
  {
    key: "member_number",
    label: "Member ID",
    sensitive: false,
    importable: true,
    synonyms: [
      "member id",
      "member no",
      "sl no",
      "slno",
      "serial",
      "serial no",
      "s no",
      "id",
      "member number",
      "membership number",
    ],
  },
  {
    key: "registration_number",
    label: "Registration No",
    sensitive: false,
    importable: true,
    synonyms: ["registration no", "registration number", "reg no", "certificate no"],
  },
  {
    key: "full_name",
    label: "Full Name",
    sensitive: false,
    importable: true,
    synonyms: ["name", "full name", "member name"],
  },
  {
    key: "garage_name",
    label: "Garage Name",
    sensitive: false,
    importable: true,
    synonyms: ["garage", "garage name", "shop", "shop name"],
  },
  {
    key: "mobile",
    label: "Mobile / WhatsApp",
    sensitive: false,
    importable: true,
    synonyms: [
      "mobile",
      "phone",
      "cell",
      "whatsapp",
      "whatsapp number",
      "cell whatsapp",
      "mobile number",
      "contact",
    ],
  },
  {
    key: "emergency_contact",
    label: "Emergency Contact",
    sensitive: false,
    importable: true,
    synonyms: ["emergency", "emergency contact", "emergency contact no", "emergency number"],
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    sensitive: false,
    importable: true,
    synonyms: ["dob", "date of birth", "birth date"],
  },
  { key: "age", label: "Age", sensitive: false, importable: false, synonyms: [] },
  {
    key: "blood_group",
    label: "Blood Group",
    sensitive: false,
    importable: true,
    synonyms: ["blood", "blood group"],
  },
  {
    key: "nominee_name",
    label: "Nominee Name",
    sensitive: false,
    importable: true,
    synonyms: ["nominee", "namini", "nominee name", "namini name"],
  },
  {
    key: "nominee_age",
    label: "Nominee Age",
    sensitive: false,
    importable: true,
    synonyms: ["nominee age", "namini age"],
  },
  {
    key: "address",
    label: "Address",
    sensitive: false,
    importable: true,
    synonyms: ["address", "shop address", "garage address"],
  },
  {
    key: "residence_address",
    label: "Residence Address",
    sensitive: false,
    importable: true,
    synonyms: ["residence", "residence address", "home address"],
  },
  {
    key: "status",
    label: "Status",
    sensitive: false,
    importable: true,
    synonyms: ["status", "membership status"],
  },
  {
    key: "registration_date",
    label: "Registration Date",
    sensitive: false,
    importable: true,
    synonyms: ["registration date", "joined", "join date", "date of joining"],
  },
  {
    key: "notes",
    label: "Notes",
    sensitive: false,
    importable: true,
    synonyms: ["notes", "remarks"],
  },
  {
    key: "aadhaar_number",
    label: "Aadhaar Number",
    sensitive: true,
    importable: true,
    synonyms: ["aadhaar", "aadhar", "aadhar no", "aadhaar no", "aadhaar number"],
  },
  {
    key: "pan_number",
    label: "PAN Number",
    sensitive: true,
    importable: true,
    synonyms: ["pan", "pan card", "pancard", "pan no", "pancard no", "pan number"],
  },
  {
    key: "driving_licence_number",
    label: "Driving Licence Number",
    sensitive: true,
    importable: true,
    synonyms: [
      "driving licence",
      "driving license",
      "dl",
      "dl no",
      "licence no",
      "license no",
      "driving licene no",
    ],
  },
];

export const SAFE_EXPORT_DEFAULT: MemberColumnKey[] = [
  "member_number",
  "full_name",
  "garage_name",
  "mobile",
  "blood_group",
  "status",
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Auto-detects which spreadsheet column maps to which member field. */
export function guessMapping(headers: string[]): Partial<Record<MemberColumnKey, number>> {
  const map: Partial<Record<MemberColumnKey, number>> = {};
  const used = new Set<number>();
  for (const col of MEMBER_COLUMNS.filter((c) => c.importable)) {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && (col.synonyms.includes(norm(h)) || norm(h) === norm(col.label)),
    );
    if (idx >= 0) {
      map[col.key] = idx;
      used.add(idx);
    }
  }
  return map;
}

/** Accepts yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy. Returns ISO or null. */
export function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 30 ? 1900 : 2000;
    return iso(y, Number(m[2]), Number(m[1]));
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ImportRowResult {
  rowNumber: number;
  input: MemberInput | null;
  errors: string[];
  duplicate: "existing" | "file" | null;
}

/**
 * Validates spreadsheet rows. Invalid rows are reported, never silently dropped.
 */
export function validateImportRows(
  rows: string[][],
  mapping: Partial<Record<MemberColumnKey, number>>,
  existingNumbers: string[],
): ImportRowResult[] {
  const existing = new Set(existingNumbers.map(normalizeMemberNumber));
  const seenInFile = new Set<string>();
  return rows.map((row, i) => {
    const get = (k: MemberColumnKey) => {
      const idx = mapping[k];
      return idx === undefined ? "" : String(row[idx] ?? "").trim();
    };
    const errors: string[] = [];
    const memberNumber = get("member_number");
    const fullName = get("full_name");
    if (!memberNumber) errors.push("Member ID is missing");
    if (!fullName) errors.push("Full name is missing");
    const mobileRaw = get("mobile");
    if (mobileRaw && !isValidIndianMobile(mobileRaw))
      errors.push(`Mobile "${mobileRaw}" is not a valid 10-digit number`);
    const emergencyRaw = get("emergency_contact");
    if (emergencyRaw && !isValidIndianMobile(emergencyRaw))
      errors.push(`Emergency contact "${emergencyRaw}" is not valid`);
    const dobRaw = get("date_of_birth");
    const dob = dobRaw ? parseFlexibleDate(dobRaw) : null;
    if (dobRaw && (!dob || computeAge(dob) === null))
      errors.push(`Date of birth "${dobRaw}" is not a valid date`);
    const regRaw = get("registration_date");
    const reg = regRaw ? parseFlexibleDate(regRaw) : null;
    if (regRaw && !reg) errors.push(`Registration date "${regRaw}" is not a valid date`);
    const nomineeAgeRaw = get("nominee_age");
    let nomineeAge: number | null = null;
    if (nomineeAgeRaw) {
      const parsedAge = Number(nomineeAgeRaw);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
        errors.push(`Nominee age "${nomineeAgeRaw}" must be 0–120`);
      } else {
        nomineeAge = parsedAge;
      }
    }
    const blood = get("blood_group").toUpperCase().replace(/\s/g, "").replace("VE", "");
    if (blood && !(BLOOD_GROUPS as readonly string[]).includes(blood))
      errors.push(`Blood group "${get("blood_group")}" not recognised`);
    const statusRaw = get("status").toLowerCase();
    const status: MemberStatus =
      statusRaw === "inactive" ? "inactive" : statusRaw === "archived" ? "archived" : "active";
    const sensitive: MemberSensitive = {
      ...EMPTY_SENSITIVE,
      aadhaar_number: get("aadhaar_number"),
      pan_number: get("pan_number").toUpperCase(),
      driving_licence_number: get("driving_licence_number"),
    };
    if (sensitive.aadhaar_number && !isValidAadhaar(sensitive.aadhaar_number))
      errors.push("Aadhaar must be 12 digits");
    if (sensitive.pan_number && !isValidPan(sensitive.pan_number))
      errors.push("PAN format looks wrong (e.g. ABCDE1234F)");
    if (
      sensitive.driving_licence_number &&
      !isValidDrivingLicence(sensitive.driving_licence_number)
    )
      errors.push("Driving licence number looks wrong");

    let duplicate: ImportRowResult["duplicate"] = null;
    if (memberNumber) {
      const n = normalizeMemberNumber(memberNumber);
      if (existing.has(n)) duplicate = "existing";
      else if (seenInFile.has(n)) duplicate = "file";
      seenInFile.add(n);
    }

    const cleanMobile = mobileRaw ? normalizePhone(mobileRaw) : "";
    const input: MemberInput | null = errors.length
      ? null
      : {
          member_number: memberNumber,
          registration_number: get("registration_number"),
          full_name: fullName,
          garage_name: get("garage_name"),
          photo_path: null,
          address: get("address"),
          residence_address: get("residence_address"),
          date_of_birth: dob,
          blood_group: blood,
          nominee_name: get("nominee_name"),
          nominee_age: nomineeAge,
          mobile: cleanMobile,
          whatsapp_number: cleanMobile,
          emergency_contact: emergencyRaw ? normalizePhone(emergencyRaw) : "",
          signature_path: null,
          status,
          registration_date: reg,
          consent_given: false,
          notes: get("notes"),
          sensitive,
        };
    return { rowNumber: i + 2, input, errors, duplicate };
  });
}

/** Prevents spreadsheet formula injection when exported files are opened in Excel. */
export function escapeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function memberToExportRow(
  m: Member,
  columns: MemberColumnKey[],
  sensitive: MemberSensitive | undefined,
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const key of columns) {
    const col = MEMBER_COLUMNS.find((c) => c.key === key)!;
    let v = "";
    switch (key) {
      case "age":
        v = String(computeAge(m.date_of_birth) ?? "");
        break;
      case "nominee_age":
        v = m.nominee_age !== null && m.nominee_age !== undefined ? String(m.nominee_age) : "";
        break;
      case "date_of_birth":
      case "registration_date":
        v = m[key] ? formatDate(m[key]) : "";
        break;
      case "aadhaar_number":
      case "pan_number":
      case "driving_licence_number":
        v = sensitive?.[key] ?? "";
        break;
      default:
        v = String(m[key] ?? "");
    }
    row[col.label] = escapeCell(v);
  }
  return row;
}

export async function downloadSheet(
  rows: Record<string, string>[],
  filename: string,
  format: "csv" | "xlsx",
  sheetName = "Members",
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.${format}`, { bookType: format });
}

export async function parseSpreadsheet(
  file: File,
): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets.");
  const sheet = wb.Sheets[sheetName]!;
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    dateNF: "yyyy-mm-dd",
    blankrows: false,
  });
  const [headerRow, ...rows] = data;
  if (!headerRow) throw new Error("The file is empty.");
  return {
    headers: headerRow.map((h) => String(h)),
    rows: rows
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => r.map((c) => String(c))),
  };
}
