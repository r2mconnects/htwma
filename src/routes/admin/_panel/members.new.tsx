import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, LoadingBlock } from "@/components/admin/common";
import { MemberForm } from "@/components/admin/MemberForm";
import { qk, useInvalidate, useMembers, useSettings } from "@/lib/data/hooks";
import { emptyMemberInput, normalizeMemberNumber } from "@/lib/members";

export const Route = createFileRoute("/admin/_panel/members/new")({
  head: () => ({ meta: [{ title: "Add Member – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: NewMember,
});

function NewMember() {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const settings = useSettings();
  const members = useMembers();
  if (members.isLoading || settings.isPlaceholderData) return <LoadingBlock />;

  const numeric = (members.data ?? []).map((m) => Number(normalizeMemberNumber(m.member_number))).filter((n) => Number.isFinite(n));
  const next = numeric.length ? Math.max(...numeric) + 1 : 1;
  const initial = { ...emptyMemberInput(), member_number: String(next) };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add member" description="Fill in the details from the registration form. Fields marked * are required." />
      <MemberForm
        initial={initial}
        memberId={null}
        requiredFields={settings.data?.required_fields ?? []}
        feeDefaults={settings.data?.fee_defaults ?? {}}
        onCancel={() => navigate({ to: "/admin/members" })}
        onSaved={async (id) => {
          await invalidate(qk.members, qk.fees);
          navigate({ to: "/admin/members/$id", params: { id } });
        }}
      />
    </div>
  );
}
