import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  class: z.string().trim().min(1).max(40),
  rollNo: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Invalid roll number"),
});

export const Route = createFileRoute("/api/public/fbise/result")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = schema.safeParse({
          class: url.searchParams.get("class") ?? "",
          rollNo: url.searchParams.get("rollNo") ?? "",
        });
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }

        const {
          getAppSettings,
          allowedClassValues,
          userFromRequest,
          hasStaffAccess,
          logSearch,
        } = await import("@/lib/access.server");

        const settings = await getAppSettings();
        if (!allowedClassValues(settings.classOptions).includes(parsed.data.class)) {
          return Response.json({ ok: false, error: "Unsupported class" }, { status: 400 });
        }

        const userId = await userFromRequest(request);
        if (settings.siteLocked) {
          if (!userId || !(await hasStaffAccess(userId))) {
            return Response.json(
              { ok: false, error: "This site is currently staff-only. Please sign in." },
              { status: 401 },
            );
          }
        }

        const { fetchResultCard } = await import("@/lib/fbise.server");
        const result = await fetchResultCard(parsed.data.class, parsed.data.rollNo);

        await logSearch({
          userId,
          classValue: parsed.data.class,
          rollNo: parsed.data.rollNo,
          status: result.ok ? "found" : "not_found",
          studentName: result.ok ? (result.studentName ?? null) : null,
        });

        return Response.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
