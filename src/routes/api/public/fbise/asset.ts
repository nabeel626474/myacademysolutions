import { createFileRoute } from "@tanstack/react-router";
import { isAllowedAsset } from "@/lib/fbise-shared";

export const Route = createFileRoute("/api/public/fbise/asset")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u") ?? "";
        if (!isAllowedAsset(target)) {
          return new Response("Forbidden asset", { status: 400 });
        }
        const upstream = await fetch(target, {
          headers: { Referer: "https://portal.fbise.edu.pk/fbise-conduct/result/" },
        });
        if (!upstream.ok) return new Response("Not found", { status: 404 });
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
