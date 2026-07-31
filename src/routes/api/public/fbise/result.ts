import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CLASS_VALUES } from "@/lib/fbise-shared";

const schema = z.object({
  class: z.string().refine((v) => CLASS_VALUES.includes(v), "Unsupported class"),
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
        const { fetchResultCard } = await import("@/lib/fbise.server");
        const result = await fetchResultCard(parsed.data.class, parsed.data.rollNo);
        return Response.json(result, {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
