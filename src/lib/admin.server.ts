/**
 * Server-only admin logic. Every exported function assumes the caller has
 * already been verified as an admin via `assertAdmin`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { ClassOption } from "./access.server";

type Client = SupabaseClient<Database>;

export async function assertAdmin(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Could not verify your access.");
  if (!data?.some((r) => r.role === "admin")) {
    throw new Error("Admins only.");
  }
}

export async function fetchSearchLogs(limit: number, search: string) {
  let query = supabaseAdmin
    .from("search_logs")
    .select("id, roll_no, class_value, status, student_name, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) query = query.ilike("roll_no", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .in("id", ids);
    for (const p of profiles ?? []) emails.set(p.id, p.email ?? "");
  }

  return (data ?? []).map((r) => ({
    ...r,
    user_email: r.user_id ? (emails.get(r.user_id) ?? null) : null,
  }));
}

export async function fetchStaff() {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const roleMap = new Map<string, string>();
  for (const r of roles ?? []) roleMap.set(r.user_id, r.role);

  return (profiles ?? []).map((p) => ({
    ...p,
    role: (roleMap.get(p.id) ?? null) as "admin" | "staff" | null,
  }));
}

export async function fetchSettings() {
  const { data, error } = await supabaseAdmin.from("app_settings").select("key, value");
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    siteLocked: map.get("site_locked") === true,
    classOptions: (Array.isArray(map.get("class_options"))
      ? map.get("class_options")
      : []) as ClassOption[],
  };
}

export async function saveSetting(key: string, value: unknown, userId: string) {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert(
      { key, value: value as never, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "staff";
}) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the account.");

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, email: input.email, full_name: input.fullName });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: data.user.id, role: input.role }, { onConflict: "user_id,role" });

  return { ok: true as const };
}

export async function setUserRole(userId: string, role: "admin" | "staff" | null) {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (role) {
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    if (error) throw new Error(error.message);
  }
  return { ok: true as const };
}

export async function removeStaffUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
