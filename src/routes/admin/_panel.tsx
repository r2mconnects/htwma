import { createFileRoute, redirect } from "@tanstack/react-router";
import { db } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/_panel")({
  ssr: false,
  beforeLoad: async () => {
    const session = await db.auth.getSession();
    if (!session) throw redirect({ to: "/admin/login" });
    return { session };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminShell,
});
