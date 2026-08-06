/**
 * Server-only helpers for the stored school-wise ranking.
 * Results are cached in `school_results` so the ranking can be shown
 * automatically without anybody typing roll numbers.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RankedSchool = {
  institution: string;
  students: number;
  passed: number;
  averageMarks: number;
  best: { rollNo: string; name: string; marks: number } | null;
};

export type ResultRow = {
  rollNo: string;
  institution: string;
  studentName: string | null;
  obtained: number | null;
  status: string | null;
  grade: string | null;
};

export async function fetchRanking(classValue: string): Promise<{
  schools: RankedSchool[];
  totalStudents: number;
  updatedAt: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("school_results")
    .select("roll_no, institution, student_name, obtained, status, updated_at")
    .eq("class_value", classValue)
    .limit(20000);
  if (error) throw new Error(error.message);

  const map = new Map<string, RankedSchool & { totalMarks: number }>();
  let updatedAt: string | null = null;

  for (const row of data ?? []) {
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
    const key = row.institution || "Unknown institution";
    const entry =
      map.get(key) ??
      { institution: key, students: 0, passed: 0, averageMarks: 0, totalMarks: 0, best: null };
    entry.students++;
    if ((row.status ?? "") !== "Fail") entry.passed++;
    const marks = row.obtained ?? 0;
    entry.totalMarks += marks;
    if (!entry.best || marks > entry.best.marks) {
      entry.best = { rollNo: row.roll_no, name: row.student_name || row.roll_no, marks };
    }
    map.set(key, entry);
  }

  const schools = Array.from(map.values())
    .map(({ totalMarks, ...s }) => ({ ...s, averageMarks: totalMarks / Math.max(s.students, 1) }))
    .sort((a, b) => b.averageMarks - a.averageMarks);

  return {
    schools,
    totalStudents: (data ?? []).length,
    updatedAt,
  };
}

export async function saveResults(classValue: string, rows: ResultRow[]) {
  if (rows.length === 0) return { saved: 0 };
  const payload = rows.map((r) => ({
    class_value: classValue,
    roll_no: r.rollNo,
    institution: r.institution || "Unknown institution",
    student_name: r.studentName,
    obtained: r.obtained,
    status: r.status,
    grade: r.grade,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("school_results")
    .upsert(payload, { onConflict: "class_value,roll_no" });
  if (error) throw new Error(error.message);
  return { saved: payload.length };
}

export async function getScanRanges(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "scan_ranges")
    .maybeSingle();
  const value = data?.value;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
}

export async function saveScanRange(classValue: string, range: string, userId: string) {
  const current = await getScanRanges();
  const next = { ...current, [classValue]: range };
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    {
      key: "scan_ranges",
      value: next as never,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return next;
}
