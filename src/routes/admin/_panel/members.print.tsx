import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/admin/common";
import { useMembers, useSettings } from "@/lib/data/hooks";
import { DEFAULT_SETTINGS } from "@/lib/data/defaults";

export const Route = createFileRoute("/admin/_panel/members/print")({
  validateSearch: (s: Record<string, unknown>) => ({
    ids: typeof s["ids"] === "string" ? s["ids"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Print Member Directory – HTWMA Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintDirectory,
});

function PrintDirectory() {
  const { ids } = Route.useSearch();
  const { data, isLoading } = useMembers();
  const settings = useSettings();
  const s = settings.data ?? DEFAULT_SETTINGS;
  if (isLoading) return <LoadingBlock />;
  const wanted = new Set(ids.split(",").filter(Boolean));
  const list = (data ?? []).filter((m) =>
    wanted.size ? wanted.has(m.id) : m.status !== "archived",
  );

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <Link
          to="/admin/members"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back to members
        </Link>
        <Button variant="navy" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-card p-6 shadow-card print:max-w-none print:p-0 print:shadow-none">
        <h1 className="text-center font-display text-xl font-black text-navy">
          {s.association_name}
        </h1>
        <p className="text-center text-sm">
          Member Directory · {list.length} members · printed{" "}
          {new Date().toLocaleDateString("en-IN")}
        </p>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-navy text-left text-navy-foreground">
              <th className="border border-foreground/30 px-2 py-1.5">ID</th>
              <th className="border border-foreground/30 px-2 py-1.5">Name</th>
              <th className="border border-foreground/30 px-2 py-1.5">Garage</th>
              <th className="border border-foreground/30 px-2 py-1.5">Mobile</th>
              <th className="border border-foreground/30 px-2 py-1.5">Blood</th>
              <th className="border border-foreground/30 px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="break-inside-avoid">
                <td className="border border-foreground/30 px-2 py-1 font-mono">
                  {m.member_number}
                </td>
                <td className="border border-foreground/30 px-2 py-1">{m.full_name}</td>
                <td className="border border-foreground/30 px-2 py-1">{m.garage_name}</td>
                <td className="border border-foreground/30 px-2 py-1">{m.mobile}</td>
                <td className="border border-foreground/30 px-2 py-1">{m.blood_group}</td>
                <td className="border border-foreground/30 px-2 py-1 capitalize">{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Confidential — for association use only. ID numbers are not included.
        </p>
      </article>
    </div>
  );
}
