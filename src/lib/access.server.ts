/**
 * Server-only helpers for the public result endpoint:
 * site lock state, admin-managed class options and search logging.
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CLASS_OPTIONS } from "./fbise-shared";
import type { Database } from "@/integrations/supabase/types";

export type ClassOption = { value: string; label: string };

export async function getAppSettings(): Promise<{
  siteLocked: boolean;
  classOptions: ClassOption[];
}> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["site_locked", "class_options"]);

  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const raw = map.get("class_options");
  const classOptions = Array.isArray(raw) && raw.length > 0 ? (raw as ClassOption[]) : [];

  return {
    siteLocked: map.get("site_locked") === true,
    classOptions,
  };
}

export function allowedClassValues(classOptions: ClassOption[]): string[] {
  const base = CLASS_OPTIONS.map((c) => c.value as string);
  return Array.from(new Set([...base, ...classOptions.map((c) => c.value)]));
}

/** Returns the signed-in user id when the request carries a valid bearer token. */
export async function userFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (token.split(".").length !== 3) return null;

  const client = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** A user only counts as staff once an admin has given them a role. */
export async function hasStaffAccess(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function logSearch(entry: {
  userId: string | null;
  classValue: string;
  rollNo: string;
  status: string;
  studentName?: string | null;
}) {
  try {
    await supabaseAdmin.from("search_logs").insert({
      user_id: entry.userId,
      class_value: entry.classValue,
      roll_no: entry.rollNo,
      status: entry.status,
      student_name: entry.studentName ?? null,
    });
  } catch (e) {
    console.error("[search_logs] insert failed", e);
  }
}

/** True once at least one admin account exists (used to hide first-time signup). */
export async function adminExists(): Promise<boolean> {
  const { data } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
  return (data?.length ?? 0) > 0;
}
