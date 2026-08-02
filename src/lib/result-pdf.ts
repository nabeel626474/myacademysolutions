import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import QRious from "qrious";
import type { CardData } from "./result-utils";

const A4_W = 794; // px @96dpi
const A4_H = 1123;

export type { CardData };
export { downloadBlob, parseRollNumbers } from "./result-utils";


/**
 * The portal renders the student-details table with `position:absolute`, so any
 * card with an extra row (fail / remarks / re-appear) overlaps the INSTITUTION
 * line underneath it. Putting that table back into normal flow keeps the school
 * name below the marks block without changing any other styling.
 */
/**
 * The portal positions the ID/Roll/Marks block absolutely, so a taller block
 * (extra rows, fail remarks) bleeds over the INSTITUTION line below it.
 * We put that block back into normal flow at exactly the same visual spot:
 * relative + inline-block keeps its original x/y and stops the surrounding
 * underline from leaking onto the ID NO / Roll No labels.
 */
function reserveSpaceForAbsoluteBlocks(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;
  const tables = Array.from(doc.querySelectorAll<HTMLTableElement>("table"));
  for (const table of tables) {
    if (view.getComputedStyle(table).position !== "absolute") continue;
    const before = table.getBoundingClientRect();
    table.style.position = "relative";
    table.style.display = "inline-block";
    table.style.verticalAlign = "top";
    table.style.top = "0px";
    table.style.left = "0px";
    table.style.marginTop = "0px";
    const afterY = table.getBoundingClientRect();
    table.style.marginTop = `${before.top - afterY.top}px`;
    const afterX = table.getBoundingClientRect();
    table.style.left = `${before.left - afterX.left}px`;
  }
}




function qrDataUrl(value: string, size: number): string | null {
  try {
    const qr = new QRious({ value, size, level: "L", foreground: "#000" });
    return qr.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * The official card draws its QR with JS (stripped during sanitising).
 * Re-draw it into the placeholder without touching any layout/size.
 */
function drawQrCodes(root: HTMLElement, values: string[]) {
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>('canvas, img[id^="qrious"], img[id^="barcode"]'),
  );

  targets.forEach((el, i) => {
    const value = values[i] ?? values[0] ?? "";
    if (!value) return;
    // Elements can live in another document (iframe), so compare tag names
    // instead of using instanceof.
    const tag = el.tagName.toLowerCase();

    if (tag === "img") {
      const dataUrl = qrDataUrl(value, 120);
      if (dataUrl) (el as HTMLImageElement).src = dataUrl;
      return;
    }

    if (tag === "canvas") {
      const canvas = el as HTMLCanvasElement;
      const size = canvas.width || 120;
      const dataUrl = qrDataUrl(value, size);
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0, size, size);
      img.src = dataUrl;
    }
  });
}

async function waitForImages(root: ParentNode) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 6000);
        }),
    ),
  );
}

/**
 * Rasterises one card inside an isolated iframe document so the portal's own
 * Word-exported CSS applies exactly as on the official page (no app styles).
 */
async function renderCardCanvas(card: CardData): Promise<HTMLCanvasElement> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_W}px;height:${A4_H}px;border:0;background:#ffffff;z-index:-1;`;
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><base href="${location.origin}/"></head><body lang="EN-US" style="tab-interval:.5in;word-wrap:break-word;background:#fff">${card.html}</body></html>`,
    );
    doc.close();

    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") return resolve();
      frame.addEventListener("load", () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });

    const body = doc.body;
    reserveSpaceForAbsoluteBlocks(doc);
    drawQrCodes(body, card.qrValues);
    await waitForImages(doc);
    await new Promise((r) => setTimeout(r, 200));

    const target = (doc.getElementById("element-to-print") as HTMLElement | null) ?? body;
    const height = Math.max(target.scrollHeight + 40, doc.documentElement.scrollHeight);
    frame.style.height = `${height}px`;
    await new Promise((r) => setTimeout(r, 60));

    return await html2canvas(body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: A4_W,
      height,
      windowWidth: A4_W,
      windowHeight: height,
    });
  } finally {
    frame.remove();
  }
}

function placeCanvas(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const imgW = A4_W;
  const imgH = (canvas.height * imgW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.92);

  if (imgH <= A4_H) {
    pdf.addImage(img, "JPEG", 0, 0, imgW, imgH);
    return;
  }
  let remaining = imgH;
  let offset = 0;
  while (remaining > 0) {
    pdf.addImage(img, "JPEG", 0, -offset, imgW, imgH);
    remaining -= A4_H;
    offset += A4_H;
    if (remaining > 0) pdf.addPage([A4_W, A4_H]);
  }
}

/** Renders the official card markup off-screen and returns an A4 PDF blob. */
export async function cardToPdfBlob(card: CardData): Promise<Blob> {
  const pdf = new jsPDF({ unit: "px", format: [A4_W, A4_H], compress: true });
  placeCanvas(pdf, await renderCardCanvas(card));
  return pdf.output("blob");
}

/** All cards in one PDF — one result card per page, same as the official layout. */
export async function cardsToSinglePdfBlob(
  cards: CardData[],
  onProgress?: (doneCount: number, total: number) => void,
): Promise<Blob> {
  const pdf = new jsPDF({ unit: "px", format: [A4_W, A4_H], compress: true });
  for (let i = 0; i < cards.length; i++) {
    if (i > 0) pdf.addPage([A4_W, A4_H]);
    placeCanvas(pdf, await renderCardCanvas(cards[i]));
    onProgress?.(i + 1, cards.length);
  }
  return pdf.output("blob");
}

export type PdfPreview = { blob: Blob; pages: string[] };

/**
 * Same rendering as the download, but also returns a PNG of every page so the
 * user can see the exact card on screen before downloading.
 */
export async function cardsToPdfPreview(
  cards: CardData[],
  onProgress?: (doneCount: number, total: number) => void,
): Promise<PdfPreview> {
  const pdf = new jsPDF({ unit: "px", format: [A4_W, A4_H], compress: true });
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (i > 0) pdf.addPage([A4_W, A4_H]);
    const canvas = await renderCardCanvas(cards[i]);
    placeCanvas(pdf, canvas);
    pages.push(canvas.toDataURL("image/jpeg", 0.9));
    onProgress?.(i + 1, cards.length);
  }
  return { blob: pdf.output("blob"), pages };
}
