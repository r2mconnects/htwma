import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/common";
import { MemberForm } from "@/components/admin/MemberForm";
import { db } from "@/lib/data";
import { qk, useInvalidate, useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";
import { emptyMemberInput } from "@/lib/members";

export const Route = createFileRoute("/admin/_panel/members/new")({
  head: () => ({ meta: [{ title: "Add Member — HTWMA Admin" }] }),
  component: NewMemberPage,
});

function NewMemberPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: settings } = useSettings();
  const nextNumber = useQuery({
    queryKey: ["members", "peek-next"],
    queryFn: () => db.members.peekNextNumber(),
  });

  if (nextNumber.isPending)
    return <p className="text-sm text-muted-foreground">Preparing registration form…</p>;

  const initial = {
    ...emptyMemberInput(),
    member_number: nextNumber.data ?? "001",
  };

  return (
    <div>
      <PageHeader
        title="Add New Member"
        subtitle="Fill in the details from the member's registration form."
      />
      <MemberForm
        initial={initial}
        memberId={null}
        requiredFields={(settings ?? DEFAULT_SETTINGS).required_fields}
        feeDefaults={(settings ?? DEFAULT_SETTINGS).fee_defaults}
        onCancel={() => navigate({ to: "/admin/members" })}
        onSaved={async (id) => {
          await invalidate(qk.members, qk.fees, qk.audit, ["members", "peek-next"]);
          navigate({ to: "/admin/members/$id", params: { id } });
        }}
      />
    </div>
  );
}
