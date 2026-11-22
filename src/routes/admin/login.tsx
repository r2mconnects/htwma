import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LockKeyhole, ArrowLeft, ShieldCheck } from "lucide-react";
import { db } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Login – HTWMA" },
      { name: "description", content: "Secure sign-in for HTWMA administrators." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin Login – HTWMA" },
      { property: "og:description", content: "Secure sign-in for HTWMA administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter your admin Gmail ID").max(120),
  password: z.string().min(1, "Enter your password").max(200),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"loading" | "login" | "reset">("loading");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (await db.auth.getSession()) {
        navigate({ to: "/admin", replace: true });
        return;
      }
      setMode("login");
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (mode === "reset") {
        await db.auth.requestPasswordReset(form.email);
        toast.success("If this email is an admin, a reset link has been sent.");
        setMode("login");
        return;
      } else {
        const r = loginSchema.safeParse(form);
        if (!r.success) {
          const errs: Record<string, string> = {};
          r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
          setErrors(errs);
          return;
        }
        await db.auth.signIn(r.data.email, r.data.password);
      }
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text", autoComplete = "off") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        autoComplete={autoComplete}
        className="mt-1.5 h-11"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        aria-invalid={!!errors[key]}
        required
      />
      {errors[key] && <p className="mt-1 text-sm text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-gradient p-12 text-navy-foreground lg:flex">
        <Logo tone="light" />
        <div>
          <ShieldCheck className="size-12 text-gold" />
          <h1 className="mt-4 font-display text-4xl font-bold">Administrator Portal</h1>
          <p className="mt-3 max-w-md text-navy-foreground/80">
            Manage member records, committee, gallery and website content. Only authorised association administrators may sign in.
          </p>
        </div>
        <p className="text-sm text-navy-foreground/60">There is no member login or public registration.</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Back to website
          </Link>
          {mode === "loading" ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : (
            <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card sm:p-8" noValidate>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <LockKeyhole className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-navy">
                    {mode === "reset" ? "Reset password" : "Admin sign in"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sign in with the association's admin Gmail ID and password.
                  </p>
                </div>
              </div>
              {field("email", "Gmail ID", "email", "username")}
              {mode !== "reset" && field("password", "Password", "password", "current-password")}
              <Button type="submit" variant="navy" size="xl" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {mode === "reset" ? "Send reset link" : "Sign in"}
              </Button>
              {db.kind === "supabase" && (
                <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>
                  {mode === "reset" ? "Back to sign in" : "Forgot password?"}
                </button>
              )}
              {db.kind === "local" && (
                <p className="rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
                  Records are currently saved in this browser on this device. Connect Supabase to see the same records on every device.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
