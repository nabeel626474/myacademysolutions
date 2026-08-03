import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_OPTIONS } from "@/lib/fbise-shared";
import { downloadBlob, parseRollNumbers, type CardData } from "@/lib/result-utils";
import logoUrl from "@/assets/academy-logo.png";

/**
 * jsPDF / html2canvas / ExcelJS / JSZip are only needed once the user asks for a
 * download or preview, so they are loaded on demand instead of shipping with the
 * initial page bundle.
 */
const loadPdf = () => import("@/lib/result-pdf");
const loadExcel = () => import("@/lib/result-excel");
const loadZip = () => import("jszip");



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Academy Solutions — Result Cards & Excel Sheets" },
      {
        name: "description",
        content:
          "Enter FBISE roll numbers to download official result cards as PDF and an auto-built Excel sheet with marks, total, percentage and grade.",
      },
      { property: "og:title", content: "My Academy Solutions — Result Cards & Excel Sheets" },
      {
        property: "og:description",
        content:
          "Enter FBISE roll numbers to download official result cards as PDF and an auto-built Excel sheet with marks, total, percentage and grade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type RowStatus = "pending" | "working" | "done" | "failed";
type Row = { rollNo: string; status: RowStatus; message?: string; card?: CardData };

function statusTone(status: RowStatus): string {
  switch (status) {
    case "done":
      return "bg-primary";
    case "failed":
      return "bg-destructive";
    case "working":
      return "bg-accent animate-pulse";
    default:
      return "bg-muted-foreground/40";
  }
}

function StatusDot({ status }: { status: RowStatus }) {
  return <span className={`inline-block size-2.5 rounded-full ${statusTone(status)}`} />;
}

function statusLabel(status: RowStatus): string {
  switch (status) {
    case "done":
      return "Ready";
    case "failed":
      return "Not Found";
    case "working":
      return "Fetching";
    default:
      return "Queued";
  }
}

type Preview = { pages: string[]; blob: Blob; name: string; label: string };

function Index() {
  const [cls, setCls] = useState<string>(CLASS_OPTIONS[0].value);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [classOptions, setClassOptions] = useState<{ value: string; label: string }[]>(() =>
    CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  );
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .then(({ data: roles }) => setIsAdmin(!!roles?.some((r) => r.role === "admin")));
    });
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "class_options")
      .maybeSingle()
      .then(({ data }) => {
        const options = data?.value;
        if (Array.isArray(options) && options.length > 0) {
          setClassOptions(options as { value: string; label: string }[]);
          setCls((current) =>
            (options as { value: string }[]).some((o) => o.value === current)
              ? current
              : (options as { value: string }[])[0].value,
          );
        }
      });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function downloadExcelSheet() {
    const sources = done
      .filter((r) => r.card)
      .map((r) => ({ rollNo: r.rollNo, html: r.card!.html }));
    if (sources.length === 0) return;
    setExcelBusy(true);
    setNotice(null);
    try {
      const label = classOptions.find((o) => o.value === cls)?.label ?? cls;
      const { buildResultWorkbook } = await loadExcel();
      const blob = await buildResultWorkbook(sources, label);
      downloadBlob(blob, `FBISE-${cls}-Result-Sheet-${sources.length}.xlsx`);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setExcelBusy(false);
    }
  }


  function closePreview() {
    setPreview(null);
  }

  async function previewOne(row: Row) {
    if (!row.card) return;
    setPreviewing(row.rollNo);
    try {
      const { cardsToPdfPreview } = await loadPdf();
      const { blob, pages } = await cardsToPdfPreview([row.card]);
      setPreview({
        pages,
        blob,
        name: `FBISE-${cls}-${row.rollNo}.pdf`,
        label: `${row.rollNo}${row.card.studentName ? ` — ${row.card.studentName}` : ""}`,
      });
    } finally {
      setPreviewing(null);
    }
  }

  async function previewAll() {
    const cards = done.map((r) => r.card).filter(Boolean) as CardData[];
    if (cards.length === 0) return;
    setPreviewing("all");
    setMerging(`0 / ${cards.length}`);
    try {
      const { cardsToPdfPreview } = await loadPdf();
      const { blob, pages } = await cardsToPdfPreview(cards, (n, total) =>
        setMerging(`${n} / ${total}`),
      );
      setPreview({
        pages,
        blob,
        name: `FBISE-${cls}-Result-Cards.pdf`,
        label: `${cards.length} result cards`,
      });
    } finally {
      setMerging(null);
      setPreviewing(null);
    }
  }




  const done = rows.filter((r) => r.status === "done");

  async function handleRun() {
    const rolls = parseRollNumbers(input);
    if (rolls.length === 0) {
      setNotice("Please enter at least one valid roll number (example: 123456 or 100100-100120).");
      return;
    }
    setNotice(null);
    setRunning(true);
    setRows(rolls.map((rollNo) => ({ rollNo, status: "pending" as RowStatus })));

    for (let i = 0; i < rolls.length; i++) {
      const rollNo = rolls[i];
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "working" } : r)));
      try {
        const res = await fetch(
          `/api/public/fbise/result?class=${encodeURIComponent(cls)}&rollNo=${encodeURIComponent(rollNo)}`,
        );
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Server error (${res.status}). The results API is not responding on this domain — please use the official site.`,
          );
        }
        const data = (await res.json()) as CardData | { ok: false; error: string };
        if (!("ok" in data) || data.ok !== true) {
          const message = "error" in data ? data.error : "Result not found";
          setRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "failed", message } : r)),
          );
          continue;
        }
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", card: data } : r)),
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "failed", message: (e as Error).message } : r,
          ),
        );
      }
    }
    setRunning(false);
  }

  async function downloadOne(row: Row) {
    if (!row.card) return;
    const { cardToPdfBlob } = await loadPdf();
    const blob = await cardToPdfBlob(row.card);
    downloadBlob(blob, `FBISE-${cls}-${row.rollNo}.pdf`);
  }

  async function downloadZip() {
    if (done.length === 0) return;
    setZipping(true);
    try {
      const [{ cardToPdfBlob }, { default: JSZip }] = await Promise.all([loadPdf(), loadZip()]);
      const zip = new JSZip();
      for (const row of done) {
        if (!row.card) continue;
        const { cardToPdfBlob } = await loadPdf();
    const blob = await cardToPdfBlob(row.card);
        zip.file(`FBISE-${cls}-${row.rollNo}.pdf`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `FBISE-${cls}-result-cards.zip`);
    } finally {
      setZipping(false);
    }
  }

  async function downloadSinglePdf() {
    const cards = done.map((r) => r.card).filter(Boolean) as CardData[];
    if (cards.length === 0) return;
    setMerging(`0 / ${cards.length}`);
    try {
      const { cardsToSinglePdfBlob } = await loadPdf();
      const blob = await cardsToSinglePdfBlob(cards, (n, total) => setMerging(`${n} / ${total}`));
      downloadBlob(blob, `FBISE-${cls}-Result-Cards.pdf`);
    } finally {
      setMerging(null);
    }
  }


  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="hero-band">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <img
              src={logoUrl}
              alt="My Academy Solutions logo"
              className="size-12 shrink-0 rounded-full bg-card p-1 shadow-md sm:size-16"
              width={64}
              height={64}
            />
            <p className="min-w-0 truncate text-[0.7rem] font-semibold uppercase tracking-[0.22em] opacity-85 sm:text-xs">
              My Academy Solutions
            </p>
            <nav aria-label="Account" className="flex items-center gap-2">
              <ThemeToggle />
              {isAdmin && (
                <Link to="/admin" className="btn-ghost btn-on-hero">
                  Dashboard
                </Link>
              )}
              {signedIn ? (
                <button
                  className="btn-ghost btn-on-hero"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  Sign out
                </button>
              ) : (
                <Link to="/auth" className="btn-ghost btn-on-hero">
                  <span className="sm:hidden">Sign in</span>
                  <span className="hidden sm:inline">Staff sign in</span>
                </Link>
              )}
            </nav>
          </div>

          <h1 className="mt-5 text-balance text-2xl font-bold leading-tight sm:text-4xl">
            Welcome to <span className="text-gradient-gold">My Academy Solutions</span>
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed opacity-85 sm:text-base">
            Enter roll numbers to get official result card PDFs plus an automatic Excel sheet with
            marks, totals, percentage and grade.
          </p>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

        <section className="panel p-5 sm:p-6" aria-labelledby="step-1">
          <div className="mb-5 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              1
            </span>
            <h2 id="step-1" className="text-sm font-semibold">
              Select class and enter roll numbers
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
            <div className="min-w-0">
              <label htmlFor="cls" className="mb-1.5 block text-sm font-semibold">
                Class / Examination
              </label>
              <select
                id="cls"
                className="field"
                value={cls}
                onChange={(e) => setCls(e.target.value)}
              >
                {classOptions.map((o) => (
                  <option key={o.value + o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="rolls" className="mb-1.5 block text-sm font-semibold">
                Roll Numbers
              </label>
              <textarea
                id="rolls"
                className="field min-h-28 font-mono"
                placeholder={"123456, 123457\n100100-100120"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={6000}
                aria-describedby="rolls-help"
                aria-invalid={notice ? true : undefined}
              />
              <p id="rolls-help" className="mt-1.5 text-xs text-muted-foreground">
                Separate with commas, spaces or new lines. Ranges work too (100100-100120).
                Maximum 300 roll numbers at a time.
              </p>
            </div>
          </div>

          <p role="alert" aria-live="assertive" className="empty:hidden">
            {notice && (
              <span className="mt-4 block text-sm font-medium text-destructive">{notice}</span>
            )}
          </p>

          <div className="mt-5">
            <button
              className="btn-primary w-full sm:w-auto"
              onClick={handleRun}
              disabled={running}
            >
              {running ? "Fetching results…" : "Get Results"}
            </button>
          </div>
        </section>

        <section className="panel mt-6 p-5 sm:p-6" aria-labelledby="step-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              2
            </span>
            <h2 id="step-2" className="text-sm font-semibold">
              Download
            </h2>
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {done.length} result{done.length === 1 ? "" : "s"} ready
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="btn-primary min-h-11 justify-center text-center"
              onClick={downloadExcelSheet}
              disabled={excelBusy || running || done.length === 0}
            >
              {excelBusy
                ? "Building Excel…"
                : `Excel Sheet — Marks, %, Grade (${done.length})`}
            </button>
            <button
              className="btn-primary min-h-11 justify-center text-center"
              onClick={downloadSinglePdf}
              disabled={merging !== null || zipping || running || done.length === 0}
            >
              {merging ? `Building PDF… ${merging}` : `All Result Cards — 1 PDF (${done.length})`}
            </button>
            <button
              className="btn-primary min-h-11 justify-center text-center"
              onClick={downloadZip}
              disabled={merging !== null || zipping || running || done.length === 0}
            >
              {zipping ? "Building ZIP…" : "Individual PDFs (ZIP)"}
            </button>
            <button
              className="btn-ghost min-h-11 justify-center text-center"
              onClick={previewAll}
              disabled={
                previewing !== null || merging !== null || zipping || running || done.length === 0
              }
            >
              {previewing === "all" ? `Building preview… ${merging ?? ""}` : "Preview All"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            The Excel file includes a class summary plus a separate sheet for every subject — with
            marks obtained, total marks, percentage and grade.
          </p>
        </section>


        {rows.length > 0 && (
          <section className="panel mt-6 overflow-hidden" aria-labelledby="results-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <h2 id="results-heading" className="text-sm font-semibold">
                Results
              </h2>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {done.length} / {rows.length} ready
              </span>
            </div>
            <ul className="grid list-none gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              {rows.map((row) => (
                <li
                  key={row.rollNo}
                  className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`h-1.5 w-full ${statusTone(row.status)}`} aria-hidden="true" />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="flex size-2.5 shrink-0 rounded-full ring-4 ring-primary/10"
                        >
                          <span
                            className={`block h-full w-full rounded-full ${statusTone(row.status)}`}
                          />
                        </span>
                        <code className="truncate font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Roll: {row.rollNo}
                        </code>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          row.status === "done"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : row.status === "failed"
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : row.status === "working"
                                ? "border-accent/30 bg-accent/15 text-accent-foreground"
                                : "border-muted bg-muted text-muted-foreground"
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </div>

                    {row.status === "done" && row.card?.studentName ? (
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-pretty text-base font-bold leading-tight text-card-foreground">
                          {row.card.studentName}
                        </h3>
                        {row.card.fatherName && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Father:</span> {row.card.fatherName}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-base font-bold leading-tight text-card-foreground">
                          {row.rollNo}
                        </h3>
                        <p className="text-pretty text-xs text-muted-foreground">
                          {row.status === "failed"
                            ? row.message ?? "Could not fetch result"
                            : row.status === "working"
                              ? "Fetching result card…"
                              : "Waiting in queue"}
                        </p>
                      </div>
                    )}

                    <div className="mt-auto h-px w-full bg-border" aria-hidden="true" />

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status === "done" ? (
                        <>
                          <button
                            className="btn-ghost min-h-11"
                            onClick={() => previewOne(row)}
                            disabled={previewing !== null}
                            aria-label={`Preview result card for roll number ${row.rollNo}`}
                          >
                            <Eye className="size-4" aria-hidden="true" />
                            <span>{previewing === row.rollNo ? "Preview…" : "Preview"}</span>
                          </button>
                          <button
                            className="btn-ghost min-h-11"
                            onClick={() => downloadOne(row)}
                            aria-label={`Download PDF for roll number ${row.rollNo}`}
                          >
                            <Download className="size-4" aria-hidden="true" />
                            <span>PDF</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.status === "failed" ? "—" : "Actions will appear here"}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

          </section>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Disclaimer: This tool only fetches result cards from the official FBISE portal
          (portal.fbise.edu.pk) and renders them as PDFs. Errors &amp; omissions excepted — the
          original document issued by the Controller of Examinations, FBISE remains the final
          authority.
        </p>
        <p className="mt-4 text-center text-xs font-semibold tracking-wide text-muted-foreground">
          Created by Usama Walayat
        </p>

      </main>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Result card PDF preview"
          onClick={closePreview}
        >
          <div
            className="panel flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">PDF Preview</h2>
                <p className="truncate text-xs text-muted-foreground">{preview.label}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => downloadBlob(preview.blob, preview.name)}
                >
                  Download PDF
                </button>
                <button className="btn-ghost" onClick={closePreview}>
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {preview.pages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Result card page ${i + 1} of ${preview.pages.length}`}
                    className="w-full rounded-md border border-border bg-card shadow-sm"
                  />
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
