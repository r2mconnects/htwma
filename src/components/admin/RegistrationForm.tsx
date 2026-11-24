import { Wrench } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";
import { useAssignments, useMembers, useRoles, useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import type { Member, MemberSensitive } from "@/lib/data/types";
import { computeAge, formatDate, maskId } from "@/lib/members";

/**
 * Print layout modelled on the association's paper form F-140/2020.
 * Pass member=null for a blank form.
 */
export function RegistrationForm({
  member,
  sensitive,
  showFullIds,
}: {
  member: Member | null;
  sensitive: MemberSensitive | null;
  showFullIds: boolean;
}) {
  const { data } = useSettings();
  const s = data ?? DEFAULT_SETTINGS;
  const roles = useRoles();
  const assignments = useAssignments();
  const members = useMembers();

  const bearers = (assignments.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => {
      const role = roles.data?.find((r) => r.id === a.role_id);
      const m = members.data?.find((x) => x.id === a.member_id);
      return role && m
        ? {
            id: a.id,
            role: role.role_name === "Executive Committee Member" ? "E.C.Member" : role.role_name,
            order: role.display_order * 100 + a.display_order,
            name: m.full_name,
            phone: a.public_phone,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.order - b.order);
  const half = Math.ceil(bearers.length / 2);
  const left = bearers.slice(0, half);
  const right = bearers.slice(half);

  const idValue = (full: string | undefined, last: string, kind: "aadhaar" | "pan" | "dl") =>
    showFullIds ? full || "" : last ? maskId(last, kind) : "";

  const nomineeDisplay = member
    ? [member.nominee_name, member.nominee_age !== null ? `Age: ${member.nominee_age}` : ""]
        .filter(Boolean)
        .join(" · ")
    : "";

  const rows: Array<[string, string]> = [
    ["Full Name", member?.full_name ?? ""],
    ["Garage Name", member?.garage_name ?? ""],
    ["Address", member?.address ?? ""],
    ["Date of Birth", member?.date_of_birth ? formatDate(member.date_of_birth) : ""],
    ["Age", member ? String(computeAge(member.date_of_birth) ?? "") : ""],
    ["Blood Group", member?.blood_group ?? ""],
    ["Nominee Name & Age", nomineeDisplay],
    ["Cell (WhatsApp)", member?.mobile ?? ""],
    ["Emergency Contact No", member?.emergency_contact ?? ""],
    [
      "Aadhaar No",
      member ? idValue(sensitive?.aadhaar_number, member.aadhaar_last4, "aadhaar") : "",
    ],
    ["Residence Address", member?.residence_address ?? ""],
    ["PAN Card No", member ? idValue(sensitive?.pan_number, member.pan_last4, "pan") : ""],
    [
      "Driving Licence No",
      member ? idValue(sensitive?.driving_licence_number, member.dl_last4, "dl") : "",
    ],
  ];

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-card p-6 text-foreground shadow-card print:max-w-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex items-center gap-4">
        {s.logo_path ? (
          <StorageImage
            bucket="public-media"
            path={s.logo_path}
            alt={s.short_name}
            className="size-16 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <Wrench className="size-16 shrink-0 text-navy" strokeWidth={1.6} />
        )}
        <div className="flex-1 text-center">
          <h1 className="font-display text-2xl font-black leading-tight text-navy sm:text-3xl">
            The Hindupur Two Wheelers
            <br />
            Mechanic &amp; Owners Association
          </h1>
          <p className="mt-1 text-xs font-semibold sm:text-sm">{s.address}</p>
        </div>
      </header>
      <div className="mt-3 bg-navy py-1 text-center text-sm font-bold uppercase tracking-wide text-navy-foreground">
        {s.form_code}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-4 text-xs">
        <div className="space-y-2">
          {left.map((b) => (
            <p key={b.id}>
              <span className="font-semibold">
                {b.role} : {b.name}
              </span>
              {b.phone && (
                <>
                  <br />
                  Cell : {b.phone}
                </>
              )}
            </p>
          ))}
        </div>
        <div className="grid h-36 w-28 place-items-center overflow-hidden border-2 border-foreground">
          {member?.photo_path ? (
            <StorageImage
              bucket="member-photos"
              path={member.photo_path}
              alt="Member photo"
              className="h-full w-full"
            />
          ) : (
            <span className="font-bold">PHOTO</span>
          )}
        </div>
        <div className="space-y-2 text-right sm:text-left">
          {right.map((b) => (
            <p key={b.id}>
              <span className="font-semibold">
                {b.role} : {b.name}
              </span>
              {b.phone && (
                <>
                  <br />
                  Cell : {b.phone}
                </>
              )}
            </p>
          ))}
        </div>
      </div>

      {member && (
        <p className="mt-4 text-sm font-semibold">
          Member ID / Sl. No.: <span className="font-mono">{member.member_number}</span>
          {member.registration_number && (
            <span className="ml-6">Reg. No.: {member.registration_number}</span>
          )}
          {member.registration_date && (
            <span className="ml-6">Date: {formatDate(member.registration_date)}</span>
          )}
        </p>
      )}

      <dl className="mt-4 space-y-3.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[11rem_1fr] items-end gap-2 text-sm">
            <dt className="font-semibold">{label}</dt>
            <dd className="dotted-line min-h-6 pb-0.5 text-muted-foreground print:text-foreground">
              : {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex items-end justify-between gap-6">
        <p className="max-w-xs text-[10px] text-muted-foreground">
          I confirm the above details are correct and consent to the association storing them for
          membership records.
        </p>
        <div className="text-center">
          <div className="grid h-14 w-44 place-items-center">
            {member?.signature_path && (
              <StorageImage
                bucket="member-signatures"
                path={member.signature_path}
                alt="Signature"
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <p className="border-t border-foreground pt-1 text-sm font-semibold">Signature</p>
        </div>
      </div>
    </article>
  );
}
