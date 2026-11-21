import lepakshi from "@/assets/lepakshi-nandi.jpg.asset.json";
import workbench from "@/assets/workshop-workbench.jpg.asset.json";
import engine from "@/assets/motorcycle-engine-repair.jpg.asset.json";
import bikes from "@/assets/bikes-street-parking.jpg.asset.json";
import type { CommitteeAssignment, CommitteeRole, GalleryItem, Member, MemberSensitive } from "../types";
import { DEFAULT_ROLES } from "../defaults";
import { sensitiveLast4 } from "@/lib/members";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function baseMember(partial: Partial<Member> & Pick<Member, "member_number" | "full_name">): Member {
  const t = now();
  return {
    id: id(),
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
    registration_date: null,
    consent_given: false,
    notes: "",
    aadhaar_last4: "",
    pan_last4: "",
    dl_last4: "",
    is_demo: false,
    created_at: t,
    updated_at: t,
    ...partial,
  };
}

/**
 * Initial data. Committee names come from the association's paper registration
 * form (F-140/2020) supplied by the user; their member numbers are unknown and
 * marked "C-xx" until confirmed. "Demo Member" rows are clearly fake and can be
 * removed from Admin → Settings → Remove demo data.
 */
export function buildSeed() {
  const roles: CommitteeRole[] = DEFAULT_ROLES.map((r, i) => ({
    id: id(),
    role_name: r.role_name,
    is_multiple_allowed: r.is_multiple_allowed,
    display_order: i + 1,
  }));
  const roleId = (name: string) => roles.find((r) => r.role_name === name)!.id;

  const committeeSource: Array<{ name: string; role: string; phone: string; show: boolean }> = [
    { name: "M. Raifq", role: "President", phone: "9290282800", show: false },
    { name: "Rahamthulla Khan", role: "Vice President", phone: "9849134093", show: false },
    { name: "M. Basavaraju", role: "General Secretary", phone: "7386557855", show: true },
    { name: "S. Inayathulla", role: "Secretary", phone: "9963620706", show: false },
    { name: "K. Abdul Sattar", role: "Treasurer", phone: "9959688121", show: false },
    { name: "S. Dastagir", role: "Executive Committee Member", phone: "9866076855", show: false },
    { name: "H. Azam", role: "Executive Committee Member", phone: "9949250124", show: false },
  ];

  const members: Member[] = [];
  const assignments: CommitteeAssignment[] = [];
  committeeSource.forEach((c, i) => {
    const m = baseMember({
      member_number: `C-${String(i + 1).padStart(2, "0")}`,
      full_name: c.name,
      mobile: c.phone,
      notes: "Committee member from paper form F-140/2020. Confirm member serial number and remaining details.",
    });
    members.push(m);
    assignments.push({
      id: id(),
      member_id: m.id,
      role_id: roleId(c.role),
      term_start: null,
      term_end: null,
      public_phone: c.phone,
      show_phone: c.show,
      public_photo_path: null,
      display_order: i + 1,
      is_active: true,
      created_at: now(),
    });
  });

  const bloods = ["O+", "B+", "A+", "AB+", "O-", "B-"];
  for (let i = 1; i <= 6; i++) {
    const n = String(i).padStart(2, "0");
    members.push(
      baseMember({
        member_number: String(190 + i),
        full_name: `Demo Member ${n}`,
        garage_name: `Sample Garage ${n}`,
        address: `[Demo] Shop ${i}, Sample Road, Hindupur`,
        residence_address: `[Demo] House ${i}, Sample Colony, Hindupur`,
        date_of_birth: `19${80 + i}-0${(i % 9) + 1}-1${i}`,
        blood_group: bloods[i - 1] ?? "",
        nominee_name: `Demo Nominee ${n}`,
        mobile: `90000000${n}`,
        emergency_contact: `90000001${n}`,
        status: i === 6 ? "archived" : i === 5 ? "inactive" : "active",
        registration_date: "2026-11-01",
        consent_given: true,
        notes: "Fake demo record for testing. Safe to delete.",
        is_demo: true,
      }),
    );
  }

  const privateData: Record<string, MemberSensitive> = {};
  members
    .filter((m) => m.is_demo)
    .forEach((m, idx) => {
      const n = String(idx + 1).padStart(2, "0");
      privateData[m.id] = {
        aadhaar_number: `00000000${"00" + n}`.slice(-12),
        pan_number: `DEMOA00${n}Z`.slice(0, 10),
        driving_licence_number: `AP0000000000${n}`,
      };
      Object.assign(m, sensitiveLast4(privateData[m.id]!));
    });

  const g = (
    url: string,
    title: string,
    category: GalleryItem["category"],
    alt: string,
    credit: string,
    order: number,
  ): GalleryItem => ({
    id: id(),
    image_path: url,
    title,
    caption: "Temporary placeholder photo — will be replaced with real association photos.",
    category,
    event_date: null,
    alt_text: alt,
    credit,
    is_published: true,
    display_order: order,
    is_demo: true,
    created_at: now(),
  });

  const gallery: GalleryItem[] = [
    g(engine.url, "Placeholder: Engine repair", "Activities", "Hands repairing a motorcycle engine with a screwdriver", "Wikimedia Commons, CC BY 2.0", 1),
    g(workbench.url, "Placeholder: Workshop tools", "Office", "A mechanic's workbench full of tools", "Unsplash via Wikimedia Commons, CC0", 2),
    g(bikes.url, "Placeholder: Two wheelers", "Events", "Scooters and motorcycles parked on a street", "Wikimedia Commons, CC0", 3),
    g(lepakshi.url, "Placeholder: Lepakshi Nandi, near Hindupur", "Other", "The giant Nandi statue at Lepakshi near Hindupur", "Wikimedia Commons, CC BY-SA 3.0", 4),
  ];

  return { roles, members, assignments, privateData, gallery };
}
