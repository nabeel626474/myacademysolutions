import { createServerFn } from "@tanstack/react-start";

export const checkAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { adminExists } = await import("@/lib/access.server");
  return { adminExists: await adminExists() };
});
