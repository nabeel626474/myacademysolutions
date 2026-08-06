import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CLASS_OPTIONS } from "@/lib/fbise-shared";
import { parseRollNumbers, type CardData } from "@/lib/result-utils";
import { parseResultHtml } from "@/lib/result-parse";
import { getSchoolRanking, saveScannedResults, setScanRange } from "@/lib/ranking.functions";

const RANK_CLASSES = CLASS_OPTIONS.filter((c) => c.value === "SSC-I" || c.value === "SSC-II");

export function SchoolRanking() {
  const queryClient = useQueryClient();
  const rankingFn = useServerFn(getSchoolRanking);
  const saveFn = useServerFn(saveScannedResults);
  const rangeFn = useServerFn(setScanRange);

  const [cls, setCls] = useState<string>(RANK_CLASSES[0]?.value ?? "SSC-I");
  const [rangeDraft, setRangeDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<number | null>(null);

  const ranking = useQuery({
    queryKey: ["school-ranking", cls],
    queryFn: () => rankingFn({ data: { classValue: cls } }),
  });

  const savedRange = ranking.data?.range ?? "";
  const range = rangeDraft ?? savedRange;

  const rangeMutation = useMutation({
    mutationFn: (value: string) => rangeFn({ data: { classValue: cls, range: value } }),
    onSuccess: () => {
      setRangeDraft(null);
      queryClient.invalidateQueries({ queryKey: ["school-ranking"] });
    },
    onError: (e: unknown) => setError((e as Error).message),
  });

  /** Refreshes the stored results from the portal using the saved roll-number range. */
  async function refresh() {
    const rolls = parseRollNumbers(range, 300);
    if (rolls.length === 0) {
      setError(
        "Add the roll-number range for this examination first (example: 100100-100200), then refresh.",
      );
      return;
    }
    setError(null);
    setBusy(true);
    setMissing(null);
    setProgress({ done: 0, total: rolls.length });

    const rows: {
      rollNo: string;
      institution: string;
      studentName: string | null;
      obtained: number | null;
      status: string | null;
      grade: string | null;
    }[] = [];
    let notFound = 0;
    let done = 0;

    const worker = async (queue: string[]) => {
      for (const rollNo of queue) {
        try {
          const res = await fetch(
            `/api/public/fbise/result?class=${encodeURIComponent(cls)}&rollNo=${encodeURIComponent(rollNo)}`,
          );
          const type = res.headers.get("content-type") ?? "";
          if (!type.includes("application/json")) throw new Error("Portal not responding");
          const data = (await res.json()) as CardData | { ok: false; error: string };
          if (!("ok" in data) || data.ok !== true) {
            notFound++;
          } else {
            const parsed = parseResultHtml(rollNo, data.html);
            rows.push({
              rollNo,
              institution: parsed.institution || "Unknown institution",
              studentName: parsed.studentName || null,
              obtained: parsed.obtained,
              status: parsed.status || null,
              grade: parsed.grade || null,
            });
          }
        } catch {
          notFound++;
        }
        done++;
        setProgress({ done, total: rolls.length });
      }
    };

    const lanes = 4;
    const queues: string[][] = Array.from({ length: lanes }, () => []);
    rolls.forEach((r, i) => queues[i % lanes].push(r));
    await Promise.all(queues.map(worker));

    try {
      for (let i = 0; i < rows.length; i += 200) {
        await saveFn({ data: { classValue: cls, rows: rows.slice(i, i + 200) } });
      }
      await queryClient.invalidateQueries({ queryKey: ["school-ranking"] });
    } catch (e) {
      setError((e as Error).message);
    }

    setMissing(notFound);
    setBusy(false);
    setProgress(null);
  }

  function exportCsv() {
    const schools = ranking.data?.schools;
    if (!schools?.length) return;
    const lines = [
      "Rank,School,Students,Passed,Pass %,Average Marks,Top Student,Top Marks",
      ...schools.map((s, i) =>
        [
          i + 1,
          `"${s.institution.replace(/"/g, "'")}"`,
          s.students,
          s.passed,
          ((s.passed / s.students) * 100).toFixed(1),
          s.averageMarks.toFixed(1),
          `"${(s.best?.name ?? "").replace(/"/g, "'")}"`,
          s.best?.marks ?? "",
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `School-Ranking-${cls}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const schools = ranking.data?.schools ?? [];

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <h2 className="text-sm font-semibold">School ranking</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Schools are ranked automatically from the results already collected — no roll numbers
          needed. Use refresh to pull the latest results for the saved range.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
          <div>
            <label htmlFor="rank-cls" className="mb-1.5 block text-sm font-semibold">
              Examination
            </label>
            <select
              id="rank-cls"
              className="field"
              value={cls}
              onChange={(e) => {
                setCls(e.target.value);
                setRangeDraft(null);
                setMissing(null);
                setError(null);
              }}
            >
              {RANK_CLASSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rank-range" className="mb-1.5 block text-sm font-semibold">
              Roll-number range to scan (saved once)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="rank-range"
                className="field flex-1 font-mono"
                placeholder="100100-100200"
                value={range}
                onChange={(e) => setRangeDraft(e.target.value)}
                maxLength={2000}
              />
              <button
                className="btn-ghost"
                onClick={() => rangeMutation.mutate(range)}
                disabled={rangeMutation.isPending || range === savedRange}
              >
                Save range
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={refresh} disabled={busy}>
            {busy
              ? `Refreshing… ${progress?.done ?? 0}/${progress?.total ?? 0}`
              : "Refresh from portal"}
          </button>
          {schools.length > 0 && (
            <button className="btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {ranking.isLoading
              ? "Loading ranking…"
              : `${schools.length} school${schools.length === 1 ? "" : "s"} · ${ranking.data?.totalStudents ?? 0} students${
                  ranking.data?.updatedAt
                    ? ` · updated ${new Date(ranking.data.updatedAt).toLocaleString()}`
                    : ""
                }`}
            {missing !== null && ` · ${missing} roll number${missing === 1 ? "" : "s"} not found`}
          </span>
        </div>
      </section>

      {!ranking.isLoading && schools.length === 0 && (
        <section className="panel p-5 text-sm text-muted-foreground">
          No results stored for this examination yet. Save a roll-number range above and press
          “Refresh from portal” once — after that the ranking loads by itself.
        </section>
      )}

      {schools.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Ranking</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">School</th>
                  <th className="px-4 py-2">Students</th>
                  <th className="px-4 py-2">Pass %</th>
                  <th className="px-4 py-2">Avg marks</th>
                  <th className="px-4 py-2">Top student</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s, i) => (
                  <tr
                    key={s.institution}
                    className="animate-fade-in border-t border-border"
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  >
                    <td className="px-4 py-2 font-bold text-primary">{i + 1}</td>
                    <td className="px-4 py-2">{s.institution}</td>
                    <td className="px-4 py-2">{s.students}</td>
                    <td className="px-4 py-2">{((s.passed / s.students) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 font-semibold">{s.averageMarks.toFixed(1)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.best ? `${s.best.name} (${s.best.marks})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
