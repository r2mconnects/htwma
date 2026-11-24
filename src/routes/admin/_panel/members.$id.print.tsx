import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { db } from "@/lib/data";
import { qk, useInvalidate, useMember } from "@/lib/data/hooks";
import type { MemberSensitive } from "@/lib/data/types";
import { RegistrationForm } from "@/components/admin/RegistrationForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/_panel/members/$id/print")({
  head: () => ({ meta: [{ title: "Print Member Form — HTWMA Admin" }] }),
  component: PrintMemberPage,
});

function PrintMemberPage() {
  const { id } = Route.useParams();
  const member = useMember(id);
  const invalidate = useInvalidate();
  const [showFull, setShowFull] = useState(false);
  const [sensitive, setSensitive] = useState<MemberSensitive | null>(null);

  useEffect(() => {
    setShowFull(false);
    setSensitive(null);
  }, [id]);

  if (member.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!member.data) return <p className="text-sm text-muted-foreground">Member not found.</p>;

  async function toggleFull(checked: boolean) {
    if (checked && !sensitive) {
      const s = await db.members.getSensitive(id);
      await db.audit.log(
        "print_sensitive",
        "member",
        id,
        `Included full ID numbers on print view for #${member.data!.member_number}`,
      );
      await invalidate(qk.audit);
      setSensitive(s);
    }
    setShowFull(checked);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/admin/members/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy"
        >
          <ArrowLeft className="size-4" /> Back to member
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showFull} onCheckedChange={(c) => void toggleFull(c === true)} />
            Include full Aadhaar / PAN / DL on print
          </label>
          <Button variant="navy" onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </div>
      <RegistrationForm member={member.data} sensitive={sensitive} showFullIds={showFull} />
    </div>
  );
}
