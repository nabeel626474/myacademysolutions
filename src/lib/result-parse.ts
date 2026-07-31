/** Parses the official FBISE result-card HTML into structured marks data. */

export type SubjectMark = { subject: string; marks: number | null; practical: number | null };

export type ParsedResult = {
  rollNo: string;
  studentName: string;
  fatherName: string;
  group: string;
  institution: string;
  regNo: string;
  subjects: SubjectMark[];
  obtained: number | null;
  status: string;
  grade: string;
};

function clean(s: string): string {
  return s
    .replace(/&nbsp;|&emsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function num(s: string): number | null {
  const m = clean(s).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Short, spreadsheet-friendly subject name: "ENGLISH - I (COMPULSORY)" -> "English" */
export function shortSubject(name: string): string {
  const base = clean(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*-\s*(I|II|III)\b/gi, " ")
    .replace(/\bTH\.?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pretty = base
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return pretty || clean(name);
}

function field(text: string, label: RegExp): string {
  const m = text.match(label);
  return m ? clean(m[1]) : "";
}

export function parseResultHtml(rollNo: string, html: string): ParsedResult {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = clean(doc.body.textContent ?? "");

  const subjects: SubjectMark[] = [];
  for (const row of Array.from(doc.querySelectorAll("tr"))) {
    const cells = Array.from(row.querySelectorAll("td, th")).map((c) => clean(c.textContent ?? ""));
    if (cells.length < 3) continue;
    const serial = cells[0];
    const subject = cells[1];
    if (!/^\d{1,2}$/.test(serial)) continue;
    if (!/[A-Za-z]{3,}/.test(subject)) continue;
    if (/subject|paper\b.*marks/i.test(subject)) continue;
    const marks = num(cells[2]);
    const practical = cells.length > 3 ? num(cells[3]) : null;
    if (marks === null && practical === null) continue;
    subjects.push({ subject, marks, practical });
  }

  const obtainedText = field(text, /Marks\s*Obt\s*:?\s*([^:]{0,60})/i);
  const obtained = num(obtainedText);
  const status = /fail/i.test(obtainedText) ? "Fail" : /pass/i.test(obtainedText) ? "Pass" : "";
  const grade = field(text, /placed\s+in\s+([A-Z+]{1,3})\b/i);

  return {
    rollNo,
    studentName: field(text, /Student\s*Name\s*:?\s*([^:]{2,80}?)\s*Father/i),
    fatherName: field(text, /Father\s*Name\s*:?\s*([^:]{2,80}?)\s*Marks\s*Obt/i),
    group: field(text, /Group\/?Trade\s*:?\s*([^:]{2,40}?)\s*Student/i),
    institution: field(text, /INSTITUTION\s*:?\s*([^:]{2,120}?)\s*(THEORY|PRACTICAL|S\.#|$)/i),
    regNo: field(text, /REG\s*:?\s*(\d{4,})/i),
    subjects,
    obtained,
    status,
    grade,
  };
}

/** Known FBISE paper totals (SSC/HSSC) keyed by short subject name. */
const KNOWN_MAX: Record<string, number> = {
  english: 75,
  urdu: 75,
  mathematics: 75,
  math: 75,
  "translation of holy quran": 50,
  "islamiyat compulsory": 100,
  islamiyat: 50,
  "pakistan studies": 50,
  physics: 60,
  chemistry: 60,
  biology: 60,
  "computer science": 60,
  computer: 60,
  "general science": 75,
  "general math": 75,
};

const STANDARD_MAX = [25, 30, 40, 50, 60, 65, 75, 80, 100, 130, 150, 200];

/** Best-guess paper total for a subject from the highest mark seen in the batch. */
export function guessMax(highest: number, subject?: string): number {
  const known = subject ? KNOWN_MAX[subject.trim().toLowerCase()] : undefined;
  if (known && known >= highest) return known;
  return STANDARD_MAX.find((m) => m >= highest) ?? Math.ceil(highest / 5) * 5;
}

export function gradeFor(percent: number): string {
  if (percent >= 96) return "A++";
  if (percent >= 91) return "A+";
  if (percent >= 86) return "A";
  if (percent >= 81) return "B++";
  if (percent >= 76) return "B+";
  if (percent >= 71) return "B";
  if (percent >= 61) return "C+";
  if (percent >= 51) return "C";
  if (percent >= 40) return "D";
  return "U";
}
