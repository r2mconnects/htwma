import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Lock, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin Sign In — HTWMA" }] }),
  beforeLoad: async () => {
    if (await db.auth.getSession()) throw redirect({ to: "/admin" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await db.auth.signIn(email, password);
      toast.success("Signed in");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your administrator email address first.");
      return;
    }
    setBusy(true);
    try {
      await db.auth.requestPasswordReset(email);
      toast.success(
        "If this email belongs to an administrator, a password reset link has been sent.",
      );
      setResetMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send password reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-hero px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy"
        >
          <ArrowLeft className="size-4" /> Back to public website
        </Link>
        <div className="rounded-2xl border bg-card p-7 shadow-elevated sm:p-8">
          <Logo compact />
          <h1 className="mt-5 font-display text-2xl font-bold text-navy">
            {resetMode ? "Reset Administrator Password" : "Admin Sign In"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resetMode
              ? "Enter your authorised administrator email to receive a password recovery link."
              : "Authorised association office-bearers only."}
          </p>

          {resetMode ? (
            <form onSubmit={onResetPassword} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="reset-email">Administrator Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11"
                  placeholder="office@htwma.org"
                />
              </div>
              <Button type="submit" variant="navy" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Send Reset Link
              </Button>
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="block w-full text-center text-xs font-medium text-muted-foreground hover:text-navy"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11"
                  placeholder="Enter admin email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-11"
                />
              </div>
              <Button type="submit" variant="navy" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Lock />} Sign In
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
