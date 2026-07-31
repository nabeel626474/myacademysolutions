import { RESULT_BASE } from "./fbise-shared";

export type CardResult =
  | {
      ok: true;
      rollNo: string;
      title: string;
      html: string;
      qrValues: string[];
      studentName?: string;
      fatherName?: string;
    }
  | { ok: false; rollNo: string; error: string };

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pickField(plain: string, label: RegExp): string | undefined {
  const m = plain.match(label);
  if (!m) return undefined;
  const value = m[1]
    .replace(
      /\b(Father Name|Student Name|Marks Obt|Group\/Trade|Institution|Roll No|ID NO|Reg)\b[\s\S]*$/i,
      "",
    )
    .trim();
  return value || undefined;
}


function absolutize(url: string): string {
  try {
    return new URL(url, RESULT_BASE).toString();
  } catch {
    return url;
  }
}

function proxied(url: string): string {
  const abs = absolutize(url);
  if (!abs.startsWith("https://portal.fbise.edu.pk")) return abs;
  return `/api/public/fbise/asset?u=${encodeURIComponent(abs)}`;
}

export async function fetchResultCard(cls: string, rollNo: string): Promise<CardResult> {
  const url = `${RESULT_BASE}result.php?class=${encodeURIComponent(cls)}&rollNo=${encodeURIComponent(
    rollNo,
  )}&name=&reg_no=`;

  let raw: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Referer: RESULT_BASE,
      },
    });
    if (!res.ok) return { ok: false, rollNo, error: `Portal returned ${res.status}` };
    raw = await res.text();
  } catch (e) {
    return { ok: false, rollNo, error: `Network error: ${(e as Error).message}` };
  }

  if (/status=failed/i.test(raw) || /no\s+record/i.test(raw)) {
    return { ok: false, rollNo, error: "Record not found on FBISE portal" };
  }

  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : `RESULT CARD - ${rollNo}`;

  // QR/barcode values the portal itself renders
  const qrValues: string[] = [];
  for (const m of raw.matchAll(/new\s+QRious\s*\(\{[\s\S]*?value:\s*['"]([^'"]*)['"]/g)) {
    qrValues.push(m[1]);
  }
  for (const m of raw.matchAll(/JsBarcode\s*\([^,]+,\s*['"]([^'"]+)['"]/g)) {
    qrValues.push(m[1]);
  }
  if (qrValues.length === 0) qrValues.push(rollNo);

  // Keep <style>, drop all <script>
  let html = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");

  // Route every remote asset through our same-origin proxy so PDF rendering
  // is not blocked by a tainted canvas.
  html = html
    .replace(/(<img\b[^>]*?\ssrc\s*=\s*")([^"]+)(")/gi, (_m, a, u, b) => a + proxied(u) + b)
    .replace(/(<img\b[^>]*?\ssrc\s*=\s*')([^']+)(')/gi, (_m, a, u, b) => a + proxied(u) + b)
    .replace(/url\((['"]?)([^)'"]+)\1\)/gi, (_m, q, u) => `url(${q}${proxied(u)}${q})`);

  if (!/<img|<table|RESULT/i.test(html)) {
    return { ok: false, rollNo, error: "Record not found on FBISE portal" };
  }

  const plain = textOf(html);
  const studentName = pickField(plain, /Student\s*Name\s*:?\s*([^:]{2,80})/i);
  const fatherName = pickField(plain, /Father\s*(?:'s)?\s*Name\s*:?\s*([^:]{2,80})/i);

  return { ok: true, rollNo, title, html, qrValues, studentName, fatherName };
}

