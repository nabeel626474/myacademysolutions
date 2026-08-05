import { useState } from "react";
import { CLASS_OPTIONS } from "@/lib/fbise-shared";
import { parseRollNumbers, type CardData } from "@/lib/result-utils";
import { parseResultHtml } from "@/lib/result-parse";

type SchoolStat = {
  institution: string;
  students: number;
  passed: number;
  totalMarks: number;
  best: { rollNo: string; name: string; marks: number } | null;
};

const RANK_CLASSES = CLASS_OPTIONS.filter((c) => c.value === "SSC-I" || c.value === "SSC-II");

export function SchoolRanking() {
  const [cls, setCls] = useState<string>(RANK_CLASSES[0]?.value ?? "SSC-I");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SchoolStat[] | null>(null);
  const [missing, setMissing] = useState(0);

  async function run() {
    const rolls = parseRollNumbers(input, 300);
    if (rolls.length === 0) {
      setError("Please enter at least one valid roll number (example: 123456 or 100100-100120).");
      return;
    }
    setError(null);
    setBusy(true);
    setStats(null);
    setMissing(0);
    setProgress({ done: 0, total: rolls.length });

    const map = new Map<string, SchoolStat>();
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
            const school = parsed.institution || "Unknown institution";
            const entry =
              map.get(school) ??
              { institution: school, students: 0, passed: 0, totalMarks: 0, best: null };
            entry.students++;
            if (parsed.status !== "Fail") entry.passed++;
            const marks = parsed.obtained ?? 0;
            entry.totalMarks += marks;
            if (!entry.best || marks > entry.best.marks) {
              entry.best = { rollNo, name: parsed.studentName || rollNo, marks };
            }
            map.set(school, entry);
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

    const ranked = Array.from(map.values()).sort(
      (a, b) => b.totalMarks / b.students - a.totalMarks / a.students,
    );
    setStats(ranked);
    setMissing(notFound);
    setBusy(false);
    setProgress(null);
  }

  function exportCsv() {
    if (!stats) return;
    const lines = [
      "Rank,School,Students,Passed,Pass %,Average Marks,Top Student,Top Marks",
      ...stats.map((s, i) =>
        [
          i + 1,
          `"${s.institution.replace(/"/g, "'")}"`,
          s.students,
          s.passed,
          ((s.passed / s.students) * 100).toFixed(1),
          (s.totalMarks / s.students).toFixed(1),
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

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <h2 className="text-sm font-semibold">School ranking — compare results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the roll numbers (or ranges) of the candidates you want to compare. Every result is
          grouped by its institution and ranked by average marks obtained.
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
              onChange={(e) => setCls(e.target.value)}
            >
              {RANK_CLASSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rank-rolls" className="mb-1.5 block text-sm font-semibold">
              Roll numbers
            </label>
            <textarea
              id="rank-rolls"
              className="field min-h-24 font-mono"
              placeholder={"100100-100200\n123456, 123457"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={6000}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? `Comparing… ${progress?.done ?? 0}/${progress?.total ?? 0}` : "Build ranking"}
          </button>
          {stats && stats.length > 0 && (
            <button className="btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
          )}
          {stats && (
            <span className="text-xs text-muted-foreground">
              {stats.length} school{stats.length === 1 ? "" : "s"} · {missing} roll number
              {missing === 1 ? "" : "s"} not found
            </span>
          )}
        </div>
      </section>

      {stats && stats.length > 0 && (
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
                {stats.map((s, i) => (
                  <tr
                    key={s.institution}
                    className="animate-fade-in border-t border-border"
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  >
                    <td className="px-4 py-2 font-bold text-primary">{i + 1}</td>
                    <td className="px-4 py-2">{s.institution}</td>
                    <td className="px-4 py-2">{s.students}</td>
                    <td className="px-4 py-2">{((s.passed / s.students) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 font-semibold">
                      {(s.totalMarks / s.students).toFixed(1)}
                    </td>
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
