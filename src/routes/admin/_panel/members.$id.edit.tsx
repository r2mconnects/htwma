import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/admin/common";
import { MemberForm } from "@/components/admin/MemberForm";
import { db } from "@/lib/data";
import { qk, useInvalidate, useMember, useSettings } from "@/lib/data/hooks";
import { memberToInput } from "@/lib/members";
import { UserX } from "lucide-react";

export const Route = createFileRoute("/admin/_panel/members/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Member – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: EditMember,
});

function EditMember() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const settings = useSettings();
  const member = useMember(id);
  const sensitive = useQuery({ queryKey: ["members", id, "sensitive-edit"], queryFn: () => db.members.getSensitive(id), gcTime: 0, staleTime: 0 });

  if (member.isLoading || sensitive.isLoading || settings.isPlaceholderData) return <LoadingBlock />;
  if (!member.data || !sensitive.data) return <EmptyState icon={<UserX className="size-6" />} title="Member not found" text="This record may have been deleted." />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${member.data.full_name}`} description={`Member ID #${member.data.member_number}`} />
      <MemberForm
        initial={memberToInput(member.data, sensitive.data)}
        memberId={id}
        requiredFields={settings.data?.required_fields ?? []}
        onCancel={() => navigate({ to: "/admin/members/$id", params: { id } })}
        onSaved={async () => {
          await invalidate(qk.members);
          navigate({ to: "/admin/members/$id", params: { id } });
        }}
      />
    </div>
  );
}
