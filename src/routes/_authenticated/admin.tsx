import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { CLASS_OPTIONS } from "@/lib/fbise-shared";
import {
  addStaffMember,
  changeStaffRole,
  deleteStaffMember,
  getAdminOverview,
  getSearchLogs,
  setClassOptions,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — My Academy Solutions" },
      {
        name: "description",
        content:
          "Review roll-number search history and manage class options and staff accounts.",
      },
      { property: "og:title", content: "Admin Dashboard — My Academy Solutions" },
      {
        property: "og:description",
        content: "Search history, class options and staff management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const defaultClassText = CLASS_OPTIONS.map((c) => `${c.value} | ${c.label}`).join("\n");

function parseClassText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split("|");
      return { value: value.trim(), label: (rest.join("|").trim() || value.trim()).slice(0, 120) };
    })
    .filter((o) => o.value);
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const logsFn = useServerFn(getSearchLogs);

  const [tab, setTab] = useState<"history" | "ranking" | "settings" | "staff">("history");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn() });
  const logs = useQuery({
    queryKey: ["admin-logs", search],
    queryFn: () => logsFn({ data: { limit: 200, search } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };
  const onError = (e: unknown) => setError((e as Error).message);

  const classFn = useServerFn(setClassOptions);
  const classMutation = useMutation({
    mutationFn: (options: { value: string; label: string }[]) => classFn({ data: { options } }),
    onSuccess: invalidate,
    onError,
  });

  const addFn = useServerFn(addStaffMember);
  const addMutation = useMutation({
    mutationFn: (input: { email: string; password: string; fullName: string; role: "admin" | "staff" }) =>
      addFn({ data: input }),
    onSuccess: invalidate,
    onError,
  });

  const roleFn = useServerFn(changeStaffRole);
  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "staff" | null }) =>
      roleFn({ data: input }),
    onSuccess: invalidate,
    onError,
  });

  const deleteFn = useServerFn(deleteStaffMember);
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: invalidate,
    onError,
  });

  const [classText, setClassText] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "staff" as "admin" | "staff",
  });

  const settings = overview.data?.settings;
  const staff = overview.data?.staff ?? [];
  const savedClassText =
    settings && settings.classOptions.length > 0
      ? settings.classOptions.map((c) => `${c.value} | ${c.label}`).join("\n")
      : defaultClassText;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (overview.isError) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(overview.error as Error).message}
        </p>
        <button className="btn-ghost mt-5" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="hero-band">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
              My Academy Solutions
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Admin Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/" className="btn-ghost">
              Home
            </Link>
            <button className="btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex flex-wrap gap-2">
          {(["history", "ranking", "settings", "staff"] as const).map((t) => (
            <button
              key={t}
              className={t === tab ? "btn-primary" : "btn-ghost"}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
            >
              {t === "history"
                ? "Search History"
                : t === "ranking"
                  ? "School Ranking"
                  : t === "settings"
                    ? "Site Settings"
                    : "Staff"}
            </button>
          ))}

        </div>

        {error && (
          <p className="mb-4 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        {tab === "history" && (
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Recent searches</h2>
              <input
                className="field ml-auto max-w-60"
                placeholder="Filter by roll number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Roll No</th>
                    <th className="px-4 py-2">Class</th>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">By</th>
                    <th className="px-4 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-2 font-mono">{row.roll_no}</td>
                      <td className="px-4 py-2">{row.class_value}</td>
                      <td className="px-4 py-2">{row.student_name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            row.status === "found"
                              ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                              : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
                          }
                        >
                          {row.status === "found" ? "Found" : "Not found"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {row.user_email ?? "Visitor"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {logs.isSuccess && (logs.data ?? []).length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                        No searches recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {logs.isLoading && <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>}
          </section>
        )}

        {tab === "settings" && (
          <div className="space-y-6">
            <section className="panel p-6">
              <h2 className="text-sm font-semibold">Class / examination options</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                One per line, written as <code>VALUE | Label shown to users</code>. The value must
                match what the FBISE portal expects.
              </p>
              <textarea
                className="field mt-3 min-h-64 font-mono text-xs"
                value={classText ?? savedClassText}
                onChange={(e) => setClassText(e.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary"
                  disabled={classMutation.isPending}
                  onClick={() => classMutation.mutate(parseClassText(classText ?? savedClassText))}
                >
                  {classMutation.isPending ? "Saving…" : "Save class list"}
                </button>
                <button className="btn-ghost" onClick={() => setClassText(defaultClassText)}>
                  Reset to built-in list
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === "staff" && (
          <div className="space-y-6">
            <section className="panel p-6">
              <h2 className="text-sm font-semibold">Add a staff account</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Full name"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                />
                <input
                  className="field"
                  type="email"
                  placeholder="Email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                />
                <input
                  className="field"
                  type="password"
                  placeholder="Temporary password (min 8 chars)"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                />
                <select
                  className="field"
                  value={newStaff.role}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, role: e.target.value as "admin" | "staff" })
                  }
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                className="btn-primary mt-4"
                disabled={addMutation.isPending}
                onClick={() =>
                  addMutation.mutate(newStaff, {
                    onSuccess: () =>
                      setNewStaff({ email: "", password: "", fullName: "", role: "staff" }),
                  })
                }
              >
                {addMutation.isPending ? "Creating…" : "Create account"}
              </button>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Accounts</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Access</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id} className="border-t border-border">
                        <td className="px-4 py-2">{member.full_name || "—"}</td>
                        <td className="px-4 py-2">{member.email}</td>
                        <td className="px-4 py-2">
                          <select
                            className="field max-w-40"
                            value={member.role ?? "none"}
                            onChange={(e) =>
                              roleMutation.mutate({
                                userId: member.id,
                                role:
                                  e.target.value === "none"
                                    ? null
                                    : (e.target.value as "admin" | "staff"),
                              })
                            }
                          >
                            <option value="none">No access</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="btn-ghost"
                            onClick={() => deleteMutation.mutate(member.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
