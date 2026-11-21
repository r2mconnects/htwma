import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LoadingBlock } from "@/components/admin/common";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { RegistrationForm } from "@/components/admin/RegistrationForm";
import { db } from "@/lib/data";
import { useMember } from "@/lib/data/hooks";
import type { MemberSensitive } from "@/lib/data/types";

export const Route = createFileRoute("/admin/_panel/members/$id/print")({
  head: () => ({ meta: [{ title: "Print Registration Form – HTWMA Admin" }, { name: "robots", content: "noindex" }] }),
  component: PrintMember,
});

function PrintMember() {
  const { id } = Route.useParams();
  const { data: m, isLoading } = useMember(id);
  const [sensitive, setSensitive] = useState<MemberSensitive | null>(null);
  if (isLoading || !m) return <LoadingBlock />;

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/members/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Back to profile
        </Link>
        <div className="flex items-center gap-4">
          {sensitive ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked onCheckedChange={() => setSensitive(null)} /> Full ID numbers shown
            </label>
          ) : (
            <ConfirmDialog
              trigger={<label className="flex cursor-pointer items-center gap-2 text-sm"><Switch checked={false} /> Show full ID numbers</label>}
              title="Print full ID numbers?"
              description={<p>The printed form will show full Aadhaar, PAN and licence numbers. Store the paper copy securely.</p>}
              confirmLabel="Show numbers"
              destructive={false}
              onConfirm={async () => {
                setSensitive(await db.members.getSensitive(id));
                await db.audit.log("print_sensitive", "member", id, `Printed form with full IDs for #${m.member_number}`);
              }}
            />
          )}
          <Button variant="navy" onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      </div>
      <RegistrationForm member={m} sensitive={sensitive} showFullIds={!!sensitive} />
    </div>
  );
}
