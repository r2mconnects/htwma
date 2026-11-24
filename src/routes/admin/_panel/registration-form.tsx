import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/common";
import { RegistrationForm } from "@/components/admin/RegistrationForm";

export const Route = createFileRoute("/admin/_panel/registration-form")({
  head: () => ({
    meta: [
      { title: "Blank Registration Form – HTWMA Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlankForm,
});

function BlankForm() {
  return (
    <div>
      <div className="mx-auto max-w-[210mm]">
        <PageHeader
          title="Blank registration form"
          description="Print copies for new members to fill in by hand. Committee names come from the Committee page."
          actions={
            <Button variant="navy" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          }
        />
      </div>
      <RegistrationForm member={null} sensitive={null} showFullIds={false} />
    </div>
  );
}
