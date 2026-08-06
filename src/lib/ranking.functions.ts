import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  rollNo: z.string().trim().min(1).max(20),
  institution: z.string().trim().max(200).default(""),
  studentName: z.string().trim().max(200).nullable().default(null),
  obtained: z.number().int().min(0).max(2000).nullable().default(null),
  status: z.string().trim().max(20).nullable().default(null),
  grade: z.string().trim().max(10).nullable().default(null),
});

export const getSchoolRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { classValue: string }) =>
    z.object({ classValue: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    const ranking = await import("@/lib/ranking.server");
    const [result, ranges] = await Promise.all([
      ranking.fetchRanking(data.classValue),
      ranking.getScanRanges(),
    ]);
    return { ...result, range: ranges[data.classValue] ?? "" };
  });

export const saveScannedResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        classValue: z.string().trim().min(1).max(40),
        rows: z.array(rowSchema).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    const ranking = await import("@/lib/ranking.server");
    return ranking.saveResults(data.classValue, data.rows);
  });

export const setScanRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { classValue: string; range: string }) =>
    z
      .object({
        classValue: z.string().trim().min(1).max(40),
        range: z.string().trim().max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/admin.server");
    await admin.assertAdmin(context.supabase, context.userId);
    const ranking = await import("@/lib/ranking.server");
    return ranking.saveScanRange(data.classValue, data.range, context.userId);
  });
