import ExcelJS from "exceljs";
import sheetAsset from "@/assets/IX_Class_board_result.xlsx.asset.json";

const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;

function normalise(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, "").trim();
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as ExcelJS.CellValue;
  if (v && typeof v === "object") {
    if ("result" in v) return String((v as { result?: unknown }).result ?? "");
    if ("text" in v) return String((v as { text?: unknown }).text ?? "");
    if ("richText" in v)
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  return String(v ?? "");
}

/**
 * Replaces every formula with its last calculated value. Shared formulas cannot
 * survive row removal, so flattening keeps the sheet identical but stable.
 */
function flattenFormulas(sheet: ExcelJS.Worksheet) {
  sheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value as ExcelJS.CellValue;
      if (v && typeof v === "object" && ("formula" in (v as object) || "sharedFormula" in (v as object))) {
        const result = (v as { result?: unknown }).result;
        cell.value = (result ?? null) as ExcelJS.CellValue;
      }
    });
  });
}

/** Finds the "Roll No" column index of a sheet (1-based), or 0 if none. */
function rollColumn(sheet: ExcelJS.Worksheet): number {
  const header = sheet.getRow(HEADER_ROW);
  let found = 0;
  header.eachCell((cell, col) => {
    if (!found && /^rollno$/i.test(normalise(cellText(cell)))) found = col;
  });
  return found;
}

/**
 * Removes every row after `lastRow`. ExcelJS' own spliceRows is a no-op when
 * the removed block reaches the end of the sheet, so the rows are cleared and
 * the sheet is truncated directly.
 */
function truncateAfter(sheet: ExcelJS.Worksheet, lastRow: number) {
  const internal = sheet as unknown as {
    _rows: unknown[];
    _merges: Record<string, { model: { top: number; left: number; bottom: number; right: number } }>;
  };
  const total = internal._rows.length;
  if (total <= lastRow) return;

  for (const key of Object.keys(internal._merges ?? {})) {
    const merge = internal._merges[key];
    if (merge?.model?.top > lastRow) {
      sheet.unMergeCells(merge.model.top, merge.model.left, merge.model.bottom, merge.model.right);
    }
  }
  for (let r = lastRow + 1; r <= total; r++) sheet.getRow(r).values = [];
  internal._rows.length = lastRow;
}

/**
 * Returns the uploaded school workbook filtered to the given roll numbers,
 * keeping the original sheets, headings, columns and styling exactly as-is.
 */
export async function filteredResultWorkbook(rollNos: string[]): Promise<Blob> {
  const wanted = new Set(rollNos.map((r) => normalise(r)));
  const res = await fetch(sheetAsset.url);
  if (!res.ok) throw new Error("Excel template load nahi hui");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());

  wb.eachSheet((sheet) => {
    flattenFormulas(sheet);

    const rollCol = rollColumn(sheet);
    if (!rollCol) return;

    const kept: ExcelJS.CellValue[][] = [];
    for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const roll = normalise(cellText(row.getCell(rollCol)));
      if (!roll || !wanted.has(roll)) continue;
      const values: ExcelJS.CellValue[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        values[col] = cell.value;
      });
      kept.push(values);
    }

    // Write the matched students into the top data rows so the original row
    // styling of the template is reused, then drop the leftover rows.
    kept.forEach((values, i) => {
      const row = sheet.getRow(FIRST_DATA_ROW + i);
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.value = col === 1 ? i + 1 : ((values[col] ?? null) as ExcelJS.CellValue);
      });
    });

    truncateAfter(sheet, FIRST_DATA_ROW + kept.length - 1);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
