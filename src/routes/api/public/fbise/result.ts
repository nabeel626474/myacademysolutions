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

        const { CLASS_VALUES } = await import("@/lib/fbise-shared");
        let allowedClasses: readonly string[] = CLASS_VALUES;
        let access: typeof import("@/lib/access.server") | null = null;

        // Database-backed class options and search logging are optional here.
        // The public result lookup must keep working on deployments where the
        // managed backend environment is unavailable.
        try {
          access = await import("@/lib/access.server");
          const settings = await access.getAppSettings();
          allowedClasses = access.allowedClassValues(settings.classOptions);
        } catch (error) {
          console.warn("[fbise/result] Using built-in class options", error);
        }

        if (!allowedClasses.includes(parsed.data.class)) {
          return Response.json({ ok: false, error: "Unsupported class" }, { status: 400 });
        }

        const { fetchResultCard } = await import("@/lib/fbise.server");
        const result = await fetchResultCard(parsed.data.class, parsed.data.rollNo);

        if (access) {
          await access.logSearch({
            userId: null,
            classValue: parsed.data.class,
            rollNo: parsed.data.rollNo,
            status: result.ok ? "found" : "not_found",
            studentName: result.ok ? (result.studentName ?? null) : null,
          });
        }

        return Response.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
