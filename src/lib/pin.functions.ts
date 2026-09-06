import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

type PinSession = { unlocked?: boolean; at?: number };

const MAX_AGE_SECONDS = 60 * 60; // one hour, same rule as staff sign-in

async function sessionConfig() {
  const { sessionPassword } = await import("@/lib/pin.server");
  return {
    password: sessionPassword(),
    name: "mas-pin",
    maxAge: MAX_AGE_SECONDS,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export const unlockWithPin = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    const { verifyPin } = await import("@/lib/pin.server");
    if (!(await verifyPin(data.pin))) return { ok: false as const };
    const session = await useSession<PinSession>(await sessionConfig());
    await session.update({ unlocked: true, at: Date.now() });
    return { ok: true as const };
  });

export const getPinStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<PinSession>(await sessionConfig());
  const at = session.data.at ?? 0;
  const fresh = !!session.data.unlocked && Date.now() - at < MAX_AGE_SECONDS * 1000;
  return { unlocked: fresh };
});

export const lockPin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PinSession>(await sessionConfig());
  await session.clear();
  return { ok: true as const };
});
