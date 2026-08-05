import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { checkAdminExists } from "@/lib/public.functions";
import logoUrl from "@/assets/academy-logo.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Sign In — My Academy Solutions" },
      {
        name: "description",
        content:
          "Sign in to the My Academy Solutions staff area to review search history and manage site settings.",
      },
      { property: "og:title", content: "Staff Sign In — My Academy Solutions" },
      {
        property: "og:description",
        content: "Staff sign in for the My Academy Solutions result card and Excel sheet tool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

async function landingRoute() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/" as const;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return roles?.some((r) => r.role === "admin") ? ("/admin" as const) : ("/" as const);
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [adminExists, setAdminExists] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) navigate({ to: await landingRoute(), replace: true });
    });
    checkAdminExists()
      .then((r) => setAdminExists(r.adminExists))
      .catch(() => setAdminExists(true));
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: await landingRoute(), replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setInfo(
          "Account created. If this is the first account it is the admin — otherwise an admin has to approve it before you get access. Check your email if confirmation is required.",
        );
      }
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

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <main className="auth-card">
        <div className="flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="My Academy Solutions logo"
            className="auth-logo size-16 rounded-full bg-card p-1 shadow-lg"
            width={64}
            height={64}
          />
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.28em] opacity-80">
            My Academy Solutions
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create admin account"}
          </h1>
          <p className="mt-1.5 text-sm opacity-80">
            {mode === "signin"
              ? "Sign in to open your results dashboard."
              : "This first account becomes the site administrator."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="auth-stagger mt-6 space-y-3.5">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide opacity-80">
                Full name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-70" aria-hidden="true" />
                <input
                  id="name"
                  className="auth-field pl-10"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide opacity-80">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-70" aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@academy.com"
                className="auth-field pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide opacity-80">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-70" aria-hidden="true" />
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="auth-field pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div aria-live="polite" className="empty:hidden">
            {error && <p className="text-sm font-semibold text-[oklch(0.85_0.16_25)]">{error}</p>}
            {info && <p className="text-sm font-medium opacity-90">{info}</p>}
          </div>

          <button className="auth-submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {!adminExists && (
          <button
            className="mt-4 w-full text-sm font-semibold underline underline-offset-4 opacity-85 transition hover:opacity-100"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "signin" ? "Create the first admin account" : "Back to sign in"}
          </button>
        )}
      </main>
    </div>
  );
}
