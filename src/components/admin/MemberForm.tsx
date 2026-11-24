import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Section } from "./common";
import {
  ImageInput,
  emptyImage,
  finalizeStagedUploads,
  rollbackStagedUploads,
  stageImageUpload,
  type ImageValue,
  type StagedUpload,
} from "./ImageInput";
import {
  DocumentInput,
  emptyDocument,
  stageDocumentUpload,
  type DocumentValue,
} from "./DocumentInput";
import { db } from "@/lib/data";
import {
  PAYMENT_MODES,
  type ConfigurableField,
  type FeeType,
  type InitialMemberFeeInput,
  type MemberInput,
  type PaymentMode,
} from "@/lib/data/types";
import { formatINR, isoDay, parseAmount } from "@/lib/fees";
import {
  BLOOD_GROUPS,
  computeAge,
  isValidAadhaar,
  isValidDrivingLicence,
  isValidIndianMobile,
  isValidPan,
  normalizePhone,
} from "@/lib/members";

const LABELS: Record<ConfigurableField, string> = {
  garage_name: "Garage name",
  mobile: "Mobile / WhatsApp",
  date_of_birth: "Date of birth",
  blood_group: "Blood group",
  nominee_name: "Nominee name",
  nominee_age: "Nominee age",
  emergency_contact: "Emergency contact",
  address: "Address",
  residence_address: "Residence address",
  aadhaar_number: "Aadhaar number",
  pan_number: "PAN number",
  driving_licence_number: "Driving licence number",
  photo: "Member photo",
};
export const CONFIGURABLE_FIELD_LABELS = LABELS;

function buildSchema(required: ConfigurableField[]) {
  const today = isoDay(new Date());
  return z
    .object({
      member_number: z
        .string()
        .trim()
        .min(1, "Member ID is required")
        .max(20, "Max 20 characters")
        .regex(/^[A-Za-z0-9/-]+$/, "Use letters, numbers, - or / only"),
      registration_number: z.string().trim().max(40, "Max 40 characters"),
      full_name: z.string().trim().min(2, "Full name is required").max(100),
      garage_name: z.string().trim().max(120),
      date_of_birth: z
        .string()
        .refine((v) => !v || (v <= today && computeAge(v) !== null), "Enter a valid past date"),
      blood_group: z.string(),
      nominee_name: z.string().trim().max(100),
      nominee_age: z
        .string()
        .trim()
        .refine((v) => {
          if (!v) return true;
          const n = Number(v);
          return Number.isInteger(n) && n >= 0 && n <= 120;
        }, "Enter a valid age (0–120)"),
      mobile: z
        .string()
        .trim()
        .refine((v) => !v || isValidIndianMobile(v), "Enter a valid 10-digit mobile number"),
      emergency_contact: z
        .string()
        .trim()
        .refine((v) => !v || isValidIndianMobile(v), "Enter a valid 10-digit number"),
      address: z.string().trim().max(400),
      residence_address: z.string().trim().max(400),
      aadhaar_number: z
        .string()
        .trim()
        .refine((v) => !v || isValidAadhaar(v), "Aadhaar must be 12 digits"),
      pan_number: z
        .string()
        .trim()
        .refine((v) => !v || isValidPan(v), "PAN format: ABCDE1234F"),
      driving_licence_number: z
        .string()
        .trim()
        .refine((v) => !v || isValidDrivingLicence(v), "8–25 letters/numbers"),
      other_doc_label: z.string().trim().max(120),
      registration_date: z.string(),
      status: z.enum(["active", "inactive", "archived"]),
      consent_given: z.boolean(),
      notes: z.string().max(1000),
    })
    .superRefine((v, ctx) => {
      for (const f of required) {
        if (f === "photo") continue;
        if (!String(v[f] ?? "").trim()) {
          ctx.addIssue({ code: "custom", path: [f], message: `${LABELS[f]} is required` });
        }
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function MemberForm({
  initial,
  memberId,
  requiredFields,
  onSaved,
  onCancel,
  feeDefaults = {},
}: {
  initial: MemberInput;
  memberId: string | null;
  requiredFields: ConfigurableField[];
  feeDefaults?: Partial<Record<FeeType, number>>;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [photo, setPhoto] = useState<ImageValue>(emptyImage(initial.photo_path));
  const [signature, setSignature] = useState<ImageValue>(emptyImage(initial.signature_path));
  const [aadhaarDoc, setAadhaarDoc] = useState<DocumentValue>(
    emptyDocument(initial.sensitive.aadhaar_doc_path),
  );
  const [panDoc, setPanDoc] = useState<DocumentValue>(
    emptyDocument(initial.sensitive.pan_doc_path),
  );
  const [dlDoc, setDlDoc] = useState<DocumentValue>(emptyDocument(initial.sensitive.dl_doc_path));
  const [otherDoc, setOtherDoc] = useState<DocumentValue>(
    emptyDocument(initial.sensitive.other_doc_path),
  );
  const [sameAddress, setSameAddress] = useState(false);
  const year = String(new Date().getFullYear());
  const [fee, setFee] = useState({
    joining: false,
    joiningAmount: String(feeDefaults.Registration ?? ""),
    annual: false,
    annualAmount: String(feeDefaults.Annual ?? ""),
    mode: "Cash" as PaymentMode,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(requiredFields)),
    defaultValues: {
      member_number: initial.member_number,
      registration_number: initial.registration_number,
      full_name: initial.full_name,
      garage_name: initial.garage_name,
      date_of_birth: initial.date_of_birth ?? "",
      blood_group: initial.blood_group,
      nominee_name: initial.nominee_name,
      nominee_age: initial.nominee_age !== null ? String(initial.nominee_age) : "",
      mobile: initial.mobile,
      emergency_contact: initial.emergency_contact,
      address: initial.address,
      residence_address: initial.residence_address,
      aadhaar_number: initial.sensitive.aadhaar_number,
      pan_number: initial.sensitive.pan_number,
      driving_licence_number: initial.sensitive.driving_licence_number,
      other_doc_label: initial.sensitive.other_doc_label,
      registration_date: initial.registration_date ?? "",
      status: initial.status,
      consent_given: initial.consent_given,
      notes: initial.notes,
    },
  });

  const { register, handleSubmit, formState, watch, setValue, setError } = form;
  const errors = formState.errors;
  const dob = watch("date_of_birth");
  const watchedAddress = watch("address");
  const age = computeAge(dob || null);
  const req = (f: ConfigurableField) => requiredFields.includes(f);

  // Keep residence_address synced in form state whenever "Same as address" is checked
  useEffect(() => {
    if (sameAddress) {
      setValue("residence_address", watchedAddress, { shouldValidate: true });
    }
  }, [sameAddress, watchedAddress, setValue]);

  async function onSubmit(v: FormValues) {
    if (req("photo") && !photo.file && (!photo.path || photo.removed)) {
      toast.error("Member photo is required");
      return;
    }
    const joiningAmount = fee.joining ? parseAmount(fee.joiningAmount) : 0;
    const annualAmount = fee.annual ? parseAmount(fee.annualAmount) : 0;
    if (!memberId && (joiningAmount === null || annualAmount === null)) {
      toast.error("Enter a valid fee amount");
      return;
    }
    if (await db.members.isNumberTaken(v.member_number, memberId)) {
      setError("member_number", { message: "This Member ID is already used by another member" });
      return;
    }

    const staged: StagedUpload[] = [];
    try {
      const stagedPhoto = await stageImageUpload(
        photo,
        "member-photos",
        db.files.upload,
        "photo.jpg",
      );
      staged.push(stagedPhoto);
      const stagedSig = await stageImageUpload(
        signature,
        "member-signatures",
        db.files.upload,
        "signature.jpg",
      );
      staged.push(stagedSig);
      const stagedAadhaar = await stageDocumentUpload(aadhaarDoc, db.files.upload);
      staged.push(stagedAadhaar);
      const stagedPan = await stageDocumentUpload(panDoc, db.files.upload);
      staged.push(stagedPan);
      const stagedDl = await stageDocumentUpload(dlDoc, db.files.upload);
      staged.push(stagedDl);
      const stagedOther = await stageDocumentUpload(otherDoc, db.files.upload);
      staged.push(stagedOther);

      const cleanMobile = v.mobile ? normalizePhone(v.mobile) : "";
      const initialFees: InitialMemberFeeInput[] = [];
      if (!memberId) {
        const paidOn = isoDay(new Date());
        if (fee.joining && joiningAmount) {
          initialFees.push({
            fee_type: "Registration",
            amount: joiningAmount,
            payment_mode: fee.mode,
            paid_on: paidOn,
            period: "",
            notes: "Collected at registration",
          });
        }
        if (fee.annual && annualAmount) {
          initialFees.push({
            fee_type: "Annual",
            amount: annualAmount,
            payment_mode: fee.mode,
            paid_on: paidOn,
            period: year,
            notes: "Collected at registration",
          });
        }
      }

      const input: MemberInput = {
        member_number: v.member_number.trim(),
        registration_number: v.registration_number.trim(),
        full_name: v.full_name.trim(),
        garage_name: v.garage_name.trim(),
        photo_path: stagedPhoto.nextPath,
        address: v.address.trim(),
        residence_address: (sameAddress ? v.address : v.residence_address).trim(),
        date_of_birth: v.date_of_birth || null,
        blood_group: v.blood_group,
        nominee_name: v.nominee_name.trim(),
        nominee_age: v.nominee_age.trim() ? Number(v.nominee_age.trim()) : null,
        mobile: cleanMobile,
        whatsapp_number: cleanMobile,
        emergency_contact: v.emergency_contact ? normalizePhone(v.emergency_contact) : "",
        signature_path: stagedSig.nextPath,
        status: v.status,
        registration_date: v.registration_date || null,
        consent_given: v.consent_given,
        notes: v.notes.trim(),
        sensitive: {
          aadhaar_number: v.aadhaar_number,
          pan_number: v.pan_number,
          driving_licence_number: v.driving_licence_number,
          aadhaar_doc_path: stagedAadhaar.nextPath,
          pan_doc_path: stagedPan.nextPath,
          dl_doc_path: stagedDl.nextPath,
          other_doc_path: stagedOther.nextPath,
          other_doc_label: v.other_doc_label.trim(),
          notes: initial.sensitive.notes,
        },
        ...(initialFees.length ? { initial_fees: initialFees } : {}),
      };

      const saved = memberId
        ? await db.members.update(memberId, input)
        : await db.members.create(input);
      await finalizeStagedUploads(staged, db.files.remove);
      toast.success(memberId ? "Member updated in Supabase" : "Member saved to Supabase");
      onSaved(saved.id);
    } catch (e) {
      await rollbackStagedUploads(staged, db.files.remove);
      toast.error(e instanceof Error ? e.message : "Could not save member");
    }
  }

  const F = ({
    name,
    label,
    required,
    type = "text",
    placeholder,
    inputMode,
    className,
  }: {
    name: keyof FormValues;
    label: string;
    required: boolean;
    type?: string;
    placeholder?: string;
    inputMode?: "numeric" | "tel" | "text";
    className?: string;
  }) => (
    <div className={className}>
      <Label htmlFor={name}>
        {label}{" "}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      <Input
        id={name}
        type={type}
        className="mt-1.5"
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={!!errors[name]}
        {...register(name)}
      />
      {errors[name] && (
        <p className="mt-1 text-sm text-destructive">{String(errors[name]?.message)}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Section
        title="1. Personal details"
        description="Basic identity details from the association registration form."
      >
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <ImageInput
            label={`Member photo${req("photo") ? " *" : ""}`}
            bucket="member-photos"
            value={photo}
            onChange={setPhoto}
            hint="Passport-style photo. Stored privately in Supabase Storage."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {F({
              name: "member_number",
              label: "Member ID / Serial No.",
              required: true,
              placeholder: "e.g. 001",
            })}
            {F({
              name: "registration_number",
              label: "Registration No.",
              required: false,
              placeholder: "Auto (e.g. HTWMA-001)",
            })}
            {F({ name: "full_name", label: "Full name", required: true })}
            {F({ name: "garage_name", label: "Garage name", required: req("garage_name") })}
            {F({ name: "nominee_name", label: "Nominee name", required: req("nominee_name") })}
            {F({
              name: "nominee_age",
              label: "Nominee age",
              required: req("nominee_age"),
              inputMode: "numeric",
              placeholder: "Years",
            })}
            <div>
              {F({
                name: "date_of_birth",
                label: "Date of birth",
                required: req("date_of_birth"),
                type: "date",
              })}
              <p className="mt-1 text-xs text-muted-foreground">
                Age: <span className="font-semibold text-foreground">{age ?? "—"}</span> (calculated
                automatically)
              </p>
            </div>
            <div>
              <Label>
                Blood group{" "}
                {req("blood_group") ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              <Select
                value={watch("blood_group") || "none"}
                onValueChange={(v) =>
                  setValue("blood_group", v === "none" ? "" : v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="mt-1.5" aria-invalid={!!errors.blood_group}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not provided</SelectItem>
                  {BLOOD_GROUPS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.blood_group && (
                <p className="mt-1 text-sm text-destructive">{errors.blood_group.message}</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="2. Contact"
        description="10-digit Indian WhatsApp and emergency contact numbers."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {F({
            name: "mobile",
            label: "Cell (WhatsApp)",
            required: req("mobile"),
            inputMode: "tel",
            placeholder: "98XXXXXXXX",
          })}
          {F({
            name: "emergency_contact",
            label: "Emergency contact no.",
            required: req("emergency_contact"),
            inputMode: "tel",
          })}
        </div>
      </Section>

      <Section
        title="3. Address"
        description="Garage/shop address and residence address are kept separately."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="address">
              Address{" "}
              {req("address") ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Textarea
              id="address"
              className="mt-1.5"
              rows={3}
              {...register("address")}
              aria-invalid={!!errors.address}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="residence_address">
              Residence address{" "}
              {req("residence_address") ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Textarea
              id="residence_address"
              className="mt-1.5"
              rows={3}
              disabled={sameAddress}
              {...register("residence_address")}
              aria-invalid={!!errors.residence_address}
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Checkbox checked={sameAddress} onCheckedChange={(c) => setSameAddress(c === true)} />{" "}
              Same as address
            </label>
            {errors.residence_address && (
              <p className="mt-1 text-sm text-destructive">{errors.residence_address.message}</p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="4. Private identity documents"
        description="Restricted — stored in private member_documents & member-documents storage. Never shown publicly."
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Collect identity documents only with the member's consent. Numbers are masked in lists and
          excluded from standard exports.
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {F({
            name: "aadhaar_number",
            label: "Aadhaar no.",
            required: req("aadhaar_number"),
            inputMode: "numeric",
            placeholder: "12 digits",
          })}
          {F({
            name: "pan_number",
            label: "PAN card no.",
            required: req("pan_number"),
            placeholder: "ABCDE1234F",
          })}
          {F({
            name: "driving_licence_number",
            label: "Driving licence no.",
            required: req("driving_licence_number"),
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DocumentInput label="Aadhaar document" value={aadhaarDoc} onChange={setAadhaarDoc} />
          <DocumentInput label="PAN document" value={panDoc} onChange={setPanDoc} />
          <DocumentInput label="Driving licence copy" value={dlDoc} onChange={setDlDoc} />
          <DocumentInput label="Other private document" value={otherDoc} onChange={setOtherDoc} />
        </div>
        {(otherDoc.file || (otherDoc.path && !otherDoc.removed)) && (
          <div className="mt-3 max-w-sm">
            {F({
              name: "other_doc_label",
              label: "Other document title",
              required: false,
              placeholder: "e.g. Trade licence / Shop lease",
            })}
          </div>
        )}

        <div className="mt-6">
          <ImageInput
            label="Signature (optional)"
            bucket="member-signatures"
            value={signature}
            onChange={setSignature}
            aspect="wide"
            maxSize={600}
            hint="Photo or scan of the member's signature. Stored privately."
          />
        </div>
      </Section>

      <Section title="5. Confirmation">
        <div className="grid gap-4 sm:grid-cols-2">
          {F({
            name: "registration_date",
            label: "Registration date",
            required: false,
            type: "date",
          })}
          <div>
            <Label>Membership status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as FormValues["status"])}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">
              Internal notes{" "}
              <span className="text-xs font-normal text-muted-foreground">(admin only)</span>
            </Label>
            <Textarea id="notes" className="mt-1.5" rows={3} {...register("notes")} />
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox
              className="mt-0.5"
              checked={watch("consent_given")}
              onCheckedChange={(c) => setValue("consent_given", c === true)}
            />
            The member has given consent for the association to store these details.
          </label>
        </div>
      </Section>

      {!memberId && (
        <Section
          title="6. Fees collected now"
          description="Optional — tick what the member paid today. Saved atomically with a sequential receipt number."
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_200px]">
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <Checkbox
                checked={fee.joining}
                onCheckedChange={(c) => setFee({ ...fee, joining: c === true })}
                aria-label="Joining fee paid"
              />
              <span className="flex-1">Joining fee</span>
              <Input
                aria-label="Joining fee amount"
                inputMode="numeric"
                className="h-9 w-24"
                value={fee.joiningAmount}
                onChange={(e) =>
                  setFee({ ...fee, joiningAmount: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <Checkbox
                checked={fee.annual}
                onCheckedChange={(c) => setFee({ ...fee, annual: c === true })}
                aria-label="Yearly fee paid"
              />
              <span className="flex-1">Yearly fee {year}</span>
              <Input
                aria-label="Yearly fee amount"
                inputMode="numeric"
                className="h-9 w-24"
                value={fee.annualAmount}
                onChange={(e) =>
                  setFee({ ...fee, annualAmount: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </label>
            <Select
              value={fee.mode}
              onValueChange={(v) => setFee({ ...fee, mode: v as PaymentMode })}
            >
              <SelectTrigger className="h-auto min-h-12" aria-label="Payment mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(fee.joining || fee.annual) && (
            <p className="mt-3 text-sm text-muted-foreground">
              Total collected now:{" "}
              <strong className="text-foreground">
                {formatINR(
                  (fee.joining ? Number(fee.joiningAmount) || 0 : 0) +
                    (fee.annual ? Number(fee.annualAmount) || 0 : 0),
                )}
              </strong>
            </p>
          )}
        </Section>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="navy" disabled={formState.isSubmitting} className="px-6">
          {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} Save member
        </Button>
      </div>
    </form>
  );
}
