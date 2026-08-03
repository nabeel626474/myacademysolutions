import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    const [settings, staff] = await Promise.all([admin.fetchSettings(), admin.fetchStaff()]);
    return { settings, staff };
  });

export const getSearchLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; search?: string }) =>
    z.object({ limit: z.number().min(1).max(500).default(100), search: z.string().max(40).default("") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    return admin.fetchSearchLogs(data.limit, data.search.trim());
  });

export const setSiteLocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { locked: boolean }) => z.object({ locked: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    return admin.saveSetting("site_locked", data.locked, context.userId);
  });

export const setClassOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { options: { value: string; label: string }[] }) =>
    z
      .object({
        options: z
          .array(
            z.object({
              value: z.string().trim().min(1).max(40),
              label: z.string().trim().min(1).max(120),
            }),
          )
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    return admin.saveSetting("class_options", data.options, context.userId);
  });

export const addStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; fullName: string; role: "admin" | "staff" }) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().max(120).default(""),
        role: z.enum(["admin", "staff"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    return admin.createStaffUser(data);
  });

export const changeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: "admin" | "staff" | null }) =>
    z
      .object({ userId: z.string().uuid(), role: z.enum(["admin", "staff"]).nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin access.");
    }
    return admin.setUserRole(data.userId, data.role);
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    return admin.removeStaffUser(data.userId);
  });
