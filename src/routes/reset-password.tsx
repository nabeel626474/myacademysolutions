import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { markSignIn } from "@/lib/session";
import logoUrl from "@/assets/academy-logo.png";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — My Academy Solutions" },
      { name: "description", content: "Set a new password for your My Academy Solutions staff account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Recovery links arrive as #type=recovery&access_token=... in the hash.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("type") === "recovery") {
      setReady(true);
      return;
    }
    // Fallback: a session may already be established by the time we land here.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      markSignIn();
      setDone(true);
      window.setTimeout(() => navigate({ to: "/", replace: true }), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-grid-lines" aria-hidden="true" />
      <div className="auth-orb auth-orb-1" aria-hidden="true" />
      <div className="auth-orb auth-orb-2" aria-hidden="true" />
      <div className="auth-orb auth-orb-3" aria-hidden="true" />
      <div className="auth-beam" aria-hidden="true" />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <main className="auth-card auth-card-glow">
        <div className="flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="My Academy Solutions logo"
            className="auth-logo auth-logo-float size-16 rounded-full bg-card p-1 shadow-lg"
            width={64}
            height={64}
          />
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.28em] opacity-80">
            My Academy Solutions
          </p>
          <h1 className="mt-1 text-2xl font-bold">Set a new password</h1>
          <p className="mt-1.5 text-sm opacity-80">
            Choose a new password for your staff account.
          </p>
        </div>

        {done ? (
          <p className="mt-6 text-center text-sm font-medium opacity-90" role="status">
            Password updated — taking you to the dashboard…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="auth-stagger mt-6 space-y-3.5">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide opacity-80">
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-70" aria-hidden="true" />
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="auth-field pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide opacity-80">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-70" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="auth-field pl-10"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={!ready}
                />
              </div>
            </div>

            <div aria-live="polite" className="empty:hidden">
              {error && <p className="text-sm font-semibold text-[oklch(0.85_0.16_25)]">{error}</p>}
            </div>

            <button className="auth-submit" disabled={busy || !ready}>
              {busy ? "Please wait…" : "Update Password"}
            </button>
          </form>
        )}

        <Link
          to="/auth"
          className="mt-4 block w-full text-center text-sm font-semibold underline underline-offset-4 opacity-85 transition hover:opacity-100"
        >
          Back to sign in
        </Link>
      </main>
    </div>
  );
}
