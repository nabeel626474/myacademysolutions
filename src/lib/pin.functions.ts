import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type PinSession = { unlocked?: boolean; at?: number };

const MAX_AGE_SECONDS = 60 * 60; // one hour, same rule as staff sign-in

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "mas-pin",
    maxAge: MAX_AGE_SECONDS,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const unlockWithPin = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PIN"];
    if (!expected) return { ok: false as const };
    if (!matches(data.pin.trim(), expected)) return { ok: false as const };
    const session = await useSession<PinSession>(sessionConfig());
    await session.update({ unlocked: true, at: Date.now() });
    return { ok: true as const };
  });

export const getPinStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<PinSession>(sessionConfig());
  const at = session.data.at ?? 0;
  const fresh = !!session.data.unlocked && Date.now() - at < MAX_AGE_SECONDS * 1000;
  return { unlocked: fresh };
});

export const lockPin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PinSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
