declare module "qrious" {
  interface QRiousOptions {
    element?: HTMLCanvasElement | HTMLImageElement | null;
    value?: string;
    size?: number;
    level?: "L" | "M" | "Q" | "H";
    foreground?: string;
    background?: string;
    padding?: number;
  }
  export default class QRious {
    constructor(options?: QRiousOptions);
    toDataURL(mime?: string): string;
  }
}
