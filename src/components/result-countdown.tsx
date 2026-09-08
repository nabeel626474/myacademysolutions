import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** HSSC 2026 1st Annual result announcement: 9 Sept 2026, 11:30 AM Pakistan time. */
export const HSSC_2026_RELEASE_MS = Date.parse("2026-09-09T11:30:00+05:00");
const WAITING_CLASSES = ["HSSC-I", "HSSC-II"];

export function isWaitingClass(value: string) {
  return WAITING_CLASSES.includes(value);
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Returns true while the result is still not out (so callers can block fetching). */
export function useResultPending(classValue: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return {
    pending: isWaitingClass(classValue) && now < HSSC_2026_RELEASE_MS,
    remaining: HSSC_2026_RELEASE_MS - now,
  };
}

export function ResultCountdown({ remaining }: { remaining: number }) {
  const { days, hours, minutes, seconds } = parts(remaining);
  const items = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];

  return (
    <section
      className="panel mt-5 overflow-hidden p-5 text-center sm:p-6"
      aria-live="polite"
      aria-label="HSSC 2026 result countdown"
    >
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Clock className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-base font-bold sm:text-lg">HSSC 2026 (1st Annual) result is not out yet</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The official announcement is on 9 September 2026 at 11:30 AM (Pakistan time). Result cards
        and Excel sheets will start working right after that.
      </p>

      <div className="mx-auto mt-5 grid max-w-md grid-cols-4 gap-2 sm:gap-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-border bg-muted/40 px-2 py-3">
            <div className="font-mono text-xl font-bold tabular-nums sm:text-2xl">
              {String(i.value).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {i.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
