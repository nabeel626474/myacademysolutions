/**
 * Lightweight helpers shared by the UI.
 * Kept out of `result-pdf.ts` so the page does not have to load
 * html2canvas / jsPDF / QRious just to parse roll numbers.
 */

export type CardData = {
  ok: true;
  rollNo: string;
  title: string;
  html: string;
  qrValues: string[];
  studentName?: string;
  fatherName?: string;
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** "1001-1004, 1010" -> ["1001","1002","1003","1004","1010"] */
export function parseRollNumbers(input: string, max = 300): string[] {
  const out: string[] = [];
  const tokens = input
    .split(/[\s,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      if (end >= start && end - start < max) {
        const pad = range[1].length;
        for (let n = start; n <= end; n++) out.push(String(n).padStart(pad, "0"));
        continue;
      }
    }
    if (/^[A-Za-z0-9-]{1,20}$/.test(token)) out.push(token);
  }
  return Array.from(new Set(out)).slice(0, max);
}
