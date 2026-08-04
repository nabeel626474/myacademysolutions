import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
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
        navigate({ to: "/admin", replace: true });
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
    <div className="min-h-screen">
      <header className="hero-band">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-7">
          <img
            src={logoUrl}
            alt="My Academy Solutions logo"
            className="size-12 shrink-0 rounded-full bg-card p-1 shadow-md"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
              My Academy Solutions
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Staff Sign In</h1>
          </div>
          <div className="ml-auto self-start">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-10">
        <section className="panel p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
                  Full name
                </label>
                <input
                  id="name"
                  className="field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            {info && <p className="text-sm font-medium text-primary">{info}</p>}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {!adminExists && (
            <button
              className="btn-ghost mt-4 w-full"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "signin" ? "Create the first admin account" : "Back to sign in"}
            </button>
          )}

        </section>
      </main>
    </div>
  );
}
