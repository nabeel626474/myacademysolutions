import ExcelJS from "exceljs";
import { parseResultHtml, shortSubject, guessMax, type ParsedResult } from "./result-parse";

export type ResultSource = { rollNo: string; html: string };

const HEAD_FILL = "FF1F4E79";
const SUB_FILL = "FFDDEBF7";

function gradeFormula(cell: string): string {
  return `IF(${cell}="","",IF(${cell}>=96,"A++",IF(${cell}>=91,"A+",IF(${cell}>=86,"A",IF(${cell}>=81,"B++",IF(${cell}>=76,"B+",IF(${cell}>=71,"B",IF(${cell}>=61,"C+",IF(${cell}>=51,"C",IF(${cell}>=40,"D","U"))))))))))`;
}

const GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C+", "C", "D", "U"] as const;
const GPA_OF: Record<string, number> = {
  "A++": 6.0,
  "A+": 5.7,
  A: 5.4,
  "B++": 5.0,
  "B+": 4.5,
  B: 4.0,
  "C+": 3.0,
  C: 2.0,
  D: 1.0,
  U: 0.0,
};

function gpaFormula(gradeCell: string): string {
  const chain = GRADES.map((g) => `IF(${gradeCell}="${g}",${GPA_OF[g].toFixed(1)},`).join("");
  return `IF(${gradeCell}="","",${chain}""${")".repeat(GRADES.length)})`;
}

/** Grade distribution (A++ .. U) + TGPA block below a marks table. */
function addGradeStats(
  sheet: ExcelJS.Worksheet,
  gradeColLetter: string,
  gpaColLetter: string,
  firstRow: number,
  lastRow: number,
  startRow: number,
) {
  const gRange = `${gradeColLetter}${firstRow}:${gradeColLetter}${lastRow}`;
  const gpaRange = `${gpaColLetter}${firstRow}:${gpaColLetter}${lastRow}`;

  const head = sheet.getRow(startRow);
  head.getCell(1).value = "Grade Summary";
  head.getCell(1).font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };

  const hdr = sheet.getRow(startRow + 1);
  ["Grade", "GPA", "No. of Students"].forEach((h, i) => {
    const cell = hdr.getCell(1 + i);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    cell.alignment = { horizontal: "center" };
  });

  GRADES.forEach((g, i) => {
    const r = sheet.getRow(startRow + 2 + i);
    r.getCell(1).value = g;
    r.getCell(2).value = GPA_OF[g];
    r.getCell(2).numFmt = "0.0";
    r.getCell(3).value = { formula: `COUNTIF(${gRange},"${g}")` } as ExcelJS.CellValue;
    [1, 2, 3].forEach((c) => {
      r.getCell(c).alignment = { horizontal: "center" };
      r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUB_FILL } };
    });
  });

  const totalRow = sheet.getRow(startRow + 2 + GRADES.length);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(3).value = {
    formula: `SUM(C${startRow + 2}:C${startRow + 1 + GRADES.length})`,
  } as ExcelJS.CellValue;

  const tgpaRow = sheet.getRow(startRow + 3 + GRADES.length);
  tgpaRow.getCell(1).value = "TGPA (Average GPA)";
  tgpaRow.getCell(3).value = {
    formula: `IF(COUNT(${gpaRange})=0,"",ROUND(AVERAGE(${gpaRange}),2))`,
  } as ExcelJS.CellValue;
  tgpaRow.getCell(3).numFmt = "0.00";

  [totalRow, tgpaRow].forEach((r) => {
    [1, 2, 3].forEach((c) => {
      r.getCell(c).font = { bold: true };
      r.getCell(c).alignment = { horizontal: "center" };
    });
    r.getCell(1).alignment = { horizontal: "left" };
  });

  borderBody(sheet, startRow + 1, startRow + 3 + GRADES.length);
}

function styleTitle(sheet: ExcelJS.Worksheet, cols: number, title: string, subtitle: string) {
  sheet.mergeCells(1, 1, 1, cols);
  sheet.mergeCells(2, 1, 2, cols);
  const t = sheet.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
  t.alignment = { horizontal: "center" };
  const s = sheet.getCell(2, 1);
  s.value = subtitle;
  s.font = { bold: true, size: 11 };
  s.alignment = { horizontal: "center" };
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
}

function styleHeader(sheet: ExcelJS.Worksheet, row: number, headers: string[]) {
  const r = sheet.getRow(row);
  r.values = headers;
  r.height = 20;
  r.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function borderBody(sheet: ExcelJS.Worksheet, from: number, to: number) {
  for (let r = from; r <= to; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
      if (!cell.alignment) cell.alignment = { horizontal: "center" };
    });
  }
}

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/*?:[\]]/g, "").slice(0, 28) || "Subject";
  let out = base;
  let i = 2;
  while (used.has(out.toLowerCase())) out = `${base.slice(0, 26)} ${i++}`;
  used.add(out.toLowerCase());
  return out;
}

/**
 * Builds a fresh workbook from the result cards that were fetched for the
 * entered roll numbers: a class summary sheet plus one sheet per subject,
 * each with marks, total, percentage and grade.
 */
export async function buildResultWorkbook(
  sources: ResultSource[],
  classLabel: string,
): Promise<Blob> {
  const students: ParsedResult[] = sources.map((s) => parseResultHtml(s.rollNo, s.html));
  if (students.length === 0) throw new Error("Please fetch results for some roll numbers first.");

  // Subject order = first appearance across students; max = highest mark seen.
  const order: string[] = [];
  const highest = new Map<string, number>();
  const fullName = new Map<string, string>();
  for (const st of students) {
    for (const sub of st.subjects) {
      const key = shortSubject(sub.subject);
      if (!order.includes(key)) {
        order.push(key);
        fullName.set(key, sub.subject);
      }
      const total = (sub.marks ?? 0) + (sub.practical ?? 0);
      highest.set(key, Math.max(highest.get(key) ?? 0, total));
    }
  }
  const maxOf = new Map(order.map((k) => [k, guessMax(highest.get(k) ?? 0, k)]));

  const marksOf = (st: ParsedResult, key: string): number | null => {
    const hit = st.subjects.find((s) => shortSubject(s.subject) === key);
    if (!hit) return null;
    if (hit.marks === null && hit.practical === null) return null;
    return (hit.marks ?? 0) + (hit.practical ?? 0);
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "FBISE Result Tool";
  const institution = students.find((s) => s.institution)?.institution ?? "FBISE";
  const subtitle = `${classLabel} — Result Summary`;
  const used = new Set<string>();

  // ---- Summary sheet ----
  const sheet = wb.addWorksheet(safeSheetName("Class Result", used), {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const headers = ["Ser #", "Roll No", "Name", "Father Name", ...order, "Obt", "Total", "Per%", "Grade", "GPA"];
  styleTitle(sheet, headers.length, institution, subtitle);
  styleHeader(sheet, 3, headers);

  students.forEach((st, i) => {
    const row = sheet.getRow(4 + i);
    const values: (string | number | null)[] = [
      i + 1,
      st.rollNo,
      st.studentName,
      st.fatherName,
      ...order.map((k) => marksOf(st, k)),
    ];
    row.values = values;
    const firstSub = 5;
    const lastSub = 4 + order.length;
    const obtCol = lastSub + 1;
    const totalCol = obtCol + 1;
    const perCol = totalCol + 1;
    const gradeCol = perCol + 1;
    const gpaCol = gradeCol + 1;
    const L = (c: number) => sheet.getColumn(c).letter;
    const r = 4 + i;
    row.getCell(obtCol).value = {
      formula: `SUM(${L(firstSub)}${r}:${L(lastSub)}${r})`,
    } as ExcelJS.CellValue;
    row.getCell(totalCol).value = order.reduce(
      (sum, k) => sum + (marksOf(st, k) === null ? 0 : (maxOf.get(k) ?? 0)),
      0,
    );
    row.getCell(perCol).value = {
      formula: `IF(${L(totalCol)}${r}=0,"",${L(obtCol)}${r}/${L(totalCol)}${r}*100)`,
    } as ExcelJS.CellValue;
    row.getCell(perCol).numFmt = "0.00";
    row.getCell(gradeCol).value = {
      formula: gradeFormula(`${L(perCol)}${r}`),
    } as ExcelJS.CellValue;
    row.getCell(gpaCol).value = {
      formula: gpaFormula(`${L(gradeCol)}${r}`),
    } as ExcelJS.CellValue;
    row.getCell(gpaCol).numFmt = "0.0";
    row.getCell(3).alignment = { horizontal: "left" };
    row.getCell(4).alignment = { horizontal: "left" };
  });

  // Max-marks reference row
  const refRow = sheet.getRow(4 + students.length + 1);
  refRow.getCell(4).value = "Max Marks";
  refRow.getCell(4).font = { bold: true, italic: true };
  order.forEach((k, i) => {
    const cell = refRow.getCell(5 + i);
    cell.value = maxOf.get(k) ?? null;
    cell.font = { bold: true, italic: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUB_FILL } };
  });

  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 30;
  sheet.getColumn(4).width = 26;
  order.forEach((k, i) => (sheet.getColumn(5 + i).width = Math.max(10, k.length + 3)));
  for (let c = 5 + order.length; c <= headers.length; c++) sheet.getColumn(c).width = 10;
  borderBody(sheet, 4, 3 + students.length);
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };
  addGradeStats(
    sheet,
    sheet.getColumn(headers.length - 1).letter,
    sheet.getColumn(headers.length).letter,
    4,
    3 + students.length,
    4 + students.length + 3,
  );

  // ---- One sheet per subject ----
  for (const key of order) {
    const max = maxOf.get(key) ?? 0;
    const rows = students
      .map((st) => ({ st, marks: marksOf(st, key) }))
      .filter((x) => x.marks !== null);
    if (rows.length === 0) continue;

    const sub = wb.addWorksheet(safeSheetName(key, used), {
      views: [{ state: "frozen", ySplit: 3 }],
    });
    const heads = ["Ser No", "Roll No", "Candidate Name", "Marks Obtained", "Total", "Per%", "Grade", "GPA"];
    styleTitle(sub, heads.length, institution, `${classLabel} (${fullName.get(key) ?? key})`);
    styleHeader(sub, 3, heads);

    rows.forEach((x, i) => {
      const r = 4 + i;
      const row = sub.getRow(r);
      row.values = [i + 1, x.st.rollNo, x.st.studentName, x.marks, max];
      row.getCell(6).value = { formula: `IF(E${r}=0,"",D${r}/E${r}*100)` } as ExcelJS.CellValue;
      row.getCell(6).numFmt = "0.00";
      row.getCell(7).value = { formula: gradeFormula(`F${r}`) } as ExcelJS.CellValue;
      row.getCell(8).value = { formula: gpaFormula(`G${r}`) } as ExcelJS.CellValue;
      row.getCell(8).numFmt = "0.0";
      row.getCell(3).alignment = { horizontal: "left" };
    });

    sub.getColumn(1).width = 8;
    sub.getColumn(2).width = 12;
    sub.getColumn(3).width = 32;
    sub.getColumn(4).width = 16;
    sub.getColumn(5).width = 10;
    sub.getColumn(6).width = 10;
    sub.getColumn(7).width = 10;
    sub.getColumn(8).width = 10;
    borderBody(sub, 4, 3 + rows.length);
    addGradeStats(sub, "G", "H", 4, 3 + rows.length, 4 + rows.length + 2);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
