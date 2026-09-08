import { useEffect, useState } from "react";
import { X, Sparkles, BookOpen } from "lucide-react";

const STORAGE_KEY = "mas_welcome_shown";

function shouldShowWelcome() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeToShow() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearWelcomeFlag() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowWelcome()) {
      setOpen(true);
      clearWelcomeFlag();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <div className="panel relative overflow-hidden p-6 text-center sm:p-8">
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close welcome message"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-7" aria-hidden="true" />
          </div>

          <h2 id="welcome-title" className="mt-4 text-xl font-bold sm:text-2xl">
            Welcome to <span className="text-gradient-gold">My Academy Solutions</span>
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            HSSC 2026 (1st Annual) results will be live very soon. Enter roll numbers to get official
            PDF result cards and auto-built Excel sheets instantly.
          </p>

          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-left">
            <div className="flex items-center gap-2 text-primary">
              <BookOpen className="size-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide">Daily reminder</span>
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed italic text-foreground">
              &ldquo;And He will provide for him from where he does not expect. And whoever relies
              upon Allah — then He is sufficient for him.&rdquo;
            </blockquote>
            <p className="mt-1 text-xs text-muted-foreground">— Surah At-Talaq (65:3)</p>

            <blockquote className="mt-3 text-sm leading-relaxed italic text-foreground">
              &ldquo;Indeed, with hardship comes ease.&rdquo;
            </blockquote>
            <p className="mt-1 text-xs text-muted-foreground">— Surah Ash-Sharh (94:6)</p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="btn-primary mt-6 w-full"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
