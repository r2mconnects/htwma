import { describe, expect, it } from "vitest";
import {
  computeAge,
  isValidAadhaar,
  isValidDrivingLicence,
  isValidIndianMobile,
  isValidPan,
  maskId,
  normalizeMemberNumber,
  normalizePhone,
} from "@/lib/members";
import {
  SAFE_EXPORT_DEFAULT,
  escapeCell,
  guessMapping,
  memberToExportRow,
  parseFlexibleDate,
  validateImportRows,
} from "@/lib/import-export";
import type { Member } from "@/lib/data/types";

describe("member validation & privacy helpers", () => {
  it("normalizes Indian mobile numbers and validates 10-digit range", () => {
    expect(normalizePhone("+91 98490-12345")).toBe("9849012345");
    expect(normalizePhone("09849012345")).toBe("9849012345");
    expect(isValidIndianMobile("9849012345")).toBe(true);
    expect(isValidIndianMobile("5123456789")).toBe(false);
  });

  it("validates Aadhaar, PAN and Driving Licence formats and masks last 4", () => {
    expect(isValidAadhaar("1234 5678 9012")).toBe(true);
    expect(isValidAadhaar("12345678")).toBe(false);
    expect(isValidPan("abcde1234f")).toBe(true);
    expect(isValidPan("12345ABCDE")).toBe(false);
    expect(isValidDrivingLicence("AP02 20190012345")).toBe(true);
    expect(maskId("9012", "aadhaar")).toBe("XXXX XXXX 9012");
    expect(maskId("234F", "pan")).toBe("••••••234F");
  });

  it("normalizes padded member numbers identically to Postgres", () => {
    expect(normalizeMemberNumber("007")).toBe("7");
    expect(normalizeMemberNumber(" 7 ")).toBe("7");
    expect(normalizeMemberNumber("htwma-01")).toBe("HTWMA-01");
  });

  it("calculates age accurately and rejects future dates", () => {
    expect(computeAge("1986-05-10", new Date(2026, 10, 24))).toBe(40);
    expect(computeAge("2028-01-01", new Date(2026, 10, 24))).toBeNull();
  });
});

describe("CSV/Excel import & export safeguards", () => {
  it("excludes sensitive columns from default export", () => {
    expect(SAFE_EXPORT_DEFAULT).not.toContain("aadhaar_number");
    expect(SAFE_EXPORT_DEFAULT).not.toContain("pan_number");
    expect(SAFE_EXPORT_DEFAULT).not.toContain("driving_licence_number");
  });

  it("maps paper register headers including Namini and Registration No", () => {
    const mapping = guessMapping([
      "Sl No",
      "Registration No",
      "Full Name",
      "Garage Name",
      "Cell WhatsApp",
      "Namini Name",
      "Namini Age",
      "Blood",
    ]);
    expect(mapping.member_number).toBe(0);
    expect(mapping.registration_number).toBe(1);
    expect(mapping.full_name).toBe(2);
    expect(mapping.garage_name).toBe(3);
    expect(mapping.mobile).toBe(4);
    expect(mapping.nominee_name).toBe(5);
    expect(mapping.nominee_age).toBe(6);
    expect(mapping.blood_group).toBe(7);
  });

  it("validates import rows, detects duplicates, and parses Indian dd/mm/yyyy dates", () => {
    expect(parseFlexibleDate("15/08/1985")).toBe("1985-08-15");
    const mapping = guessMapping(["Member ID", "Full Name", "Mobile", "DOB", "Nominee Age"]);
    const results = validateImportRows(
      [
        ["001", "Existing Member", "9849012345", "15/08/1985", "34"],
        ["002", "New Valid Member", "9440112233", "10/01/1990", "28"],
        ["003", "Bad Phone Member", "12345", "10/01/1990", "200"],
      ],
      mapping,
      ["1"],
    );
    expect(results[0]?.duplicate).toBe("existing");
    expect(results[1]?.duplicate).toBeNull();
    expect(results[1]?.input?.nominee_age).toBe(28);
    expect(results[2]?.input).toBeNull();
    expect(results[2]?.errors.length).toBe(2);
  });

  it("escapes Excel formula injection on export", () => {
    expect(escapeCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    const m: Member = {
      id: "m1",
      member_number: "001",
      registration_number: "HTWMA-001",
      full_name: "=MaliciousFormula",
      garage_name: "Safe Garage",
      photo_path: null,
      signature_path: null,
      address: "",
      residence_address: "",
      date_of_birth: "1985-08-15",
      blood_group: "O+",
      nominee_name: "Lakshmi",
      nominee_age: 35,
      mobile: "9849012345",
      whatsapp_number: "9849012345",
      emergency_contact: "",
      aadhaar_last4: "1234",
      pan_last4: "",
      dl_last4: "",
      status: "active",
      registration_date: "2026-11-24",
      consent_given: true,
      notes: "",
      is_demo: false,
      created_at: "",
      updated_at: "",
    };
    const exported = memberToExportRow(m, SAFE_EXPORT_DEFAULT, undefined);
    expect(exported["Full Name"]).toBe("'=MaliciousFormula");
    expect(exported["Aadhaar Number"]).toBeUndefined();
  });
});
