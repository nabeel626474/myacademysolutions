import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import JSZip from "jszip";
import { CLASS_OPTIONS } from "@/lib/fbise-shared";
import {
  cardToPdfBlob,
  cardsToSinglePdfBlob,
  cardsToPdfPreview,
  downloadBlob,
  parseRollNumbers,
  type CardData,
} from "@/lib/result-pdf";
import { buildResultWorkbook } from "@/lib/result-excel";
import logoUrl from "@/assets/academy-logo.png";


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

function StatusDot({ status }: { status: RowStatus }) {
  const tone =
    status === "done"
      ? "bg-primary"
      : status === "failed"
        ? "bg-destructive"
        : status === "working"
          ? "bg-accent animate-pulse"
          : "bg-muted-foreground/40";
  return <span className={`inline-block size-2.5 rounded-full ${tone}`} />;
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

  async function downloadExcelSheet() {
    const sources = done
      .filter((r) => r.card)
      .map((r) => ({ rollNo: r.rollNo, html: r.card!.html }));
    if (sources.length === 0) return;
    setExcelBusy(true);
    setNotice(null);
    try {
      const label = CLASS_OPTIONS.find((o) => o.value === cls)?.label ?? cls;
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
      setNotice("Kam az kam aik valid roll number likhein (misal: 123456 ya 100100-100120).");
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
    const blob = await cardToPdfBlob(row.card);
    downloadBlob(blob, `FBISE-${cls}-${row.rollNo}.pdf`);
  }

  async function downloadZip() {
    if (done.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const row of done) {
        if (!row.card) continue;
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
      const blob = await cardsToSinglePdfBlob(cards, (n, total) => setMerging(`${n} / ${total}`));
      downloadBlob(blob, `FBISE-${cls}-Result-Cards.pdf`);
    } finally {
      setMerging(null);
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="hero-band">
        <div className="mx-auto flex max-w-5xl items-center gap-5 px-5 py-9">
          <img
            src={logoUrl}
            alt="My Academy Solutions logo"
            className="size-16 shrink-0 rounded-full bg-card p-1 shadow-md sm:size-20"
            width={80}
            height={80}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
              My Academy Solutions
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">
              Welcome to My Academy Solutions
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <section className="panel p-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <h2 className="text-sm font-semibold">Select class and enter roll numbers</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
            <div>
              <label htmlFor="cls" className="mb-1.5 block text-sm font-semibold">
                Class / Examination
              </label>
              <select
                id="cls"
                className="field"
                value={cls}
                onChange={(e) => setCls(e.target.value)}
              >
                {CLASS_OPTIONS.map((o) => (
                  <option key={o.value + o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
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
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Separate with commas, spaces or new lines. Ranges work too (100100-100120).
                Maximum 300 roll numbers at a time.
              </p>
            </div>
          </div>

          {notice && <p className="mt-4 text-sm font-medium text-destructive">{notice}</p>}

          <div className="mt-5">
            <button className="btn-primary" onClick={handleRun} disabled={running}>
              {running ? "Fetching results…" : "Get Results"}
            </button>
          </div>
        </section>

        <section className="panel mt-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <h2 className="text-sm font-semibold">Download</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {done.length} result ready
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="btn-primary"
              onClick={downloadExcelSheet}
              disabled={excelBusy || running || done.length === 0}
            >
              {excelBusy
                ? "Building Excel…"
                : `Excel Sheet — Marks, %, Grade (${done.length})`}
            </button>
            <button
              className="btn-primary"
              onClick={downloadSinglePdf}
              disabled={merging !== null || zipping || running || done.length === 0}
            >
              {merging ? `Building PDF… ${merging}` : `All Result Cards — 1 PDF (${done.length})`}
            </button>
            <button
              className="btn-primary"
              onClick={downloadZip}
              disabled={merging !== null || zipping || running || done.length === 0}
            >
              {zipping ? "Building ZIP…" : "Individual PDFs (ZIP)"}
            </button>
            <button
              className="btn-ghost"
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
          <section className="panel mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Results</h2>
              <span className="text-xs text-muted-foreground">
                {done.length} / {rows.length} ready
              </span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.rollNo} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-1.5">
                    <StatusDot status={row.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-sm font-semibold">{row.rollNo}</span>
                      {row.card?.studentName && (
                        <span className="text-sm font-semibold">{row.card.studentName}</span>
                      )}
                    </div>
                    {row.card?.fatherName && (
                      <p className="text-xs text-muted-foreground">
                        Father Name: {row.card.fatherName}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {row.status === "failed"
                        ? row.message
                        : row.status === "done"
                          ? (row.card?.title ?? "Result card ready")
                          : row.status === "working"
                            ? "Fetching…"
                            : "Queued"}
                    </p>
                  </div>
                  {row.status === "done" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => previewOne(row)}
                        disabled={previewing !== null}
                      >
                        {previewing === row.rollNo ? "Preview…" : "Preview"}
                      </button>
                      <button className="btn-ghost" onClick={() => downloadOne(row)}>
                        Download PDF
                      </button>
                    </div>
                  )}

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
