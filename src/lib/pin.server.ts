/**
 * Server-only helpers for the shared access PIN.
 *
 * The PIN is stored (hashed) in `app_settings` so an admin can change it from
 * the dashboard. If the database is unreachable we fall back to the SITE_PIN
 * environment variable and finally to the original default, so the unlock
 * screen keeps working on any host.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_PIN = "1996";
export const PIN_SETTING_KEY = "site_pin_hash";

export function hashPin(pin: string) {
  return createHash("sha256").update(pin.trim(), "utf8").digest("hex");
}

/** A session password must be at least 32 characters; derive one when missing. */
export function sessionPassword() {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length >= 32) return secret;
  const seed =
    (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "") +
    (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "") +
    "my-academy-solutions-pin-session";
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

async function storedHash(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", PIN_SETTING_KEY)
      .maybeSingle();
    const value = data?.value;
    return typeof value === "string" && value.length === 64 ? value : null;
  } catch {
    return null;
  }
}

export async function verifyPin(input: string): Promise<boolean> {
  const expected = (await storedHash()) ?? hashPin(process.env["SITE_PIN"] || DEFAULT_PIN);
  const a = Buffer.from(hashPin(input), "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
