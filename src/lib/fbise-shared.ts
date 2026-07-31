const PORTAL_ORIGIN = "https://portal.fbise.edu.pk";
export const RESULT_BASE = `${PORTAL_ORIGIN}/fbise-conduct/result/`;

export const CLASS_OPTIONS = [
  { value: "SSC-I", label: "SSC-I (2026) 1st Annual" },
  { value: "SSC-II", label: "SSC-II (2026) 1st Annual" },
  { value: "SSC-I-2nd", label: "SSC-I 2nd Annual (2025)" },
  { value: "SSC-II-2nd", label: "SSC-II 2nd Annual (2025)" },
  { value: "SSC-I-TECH", label: "SSC-I (Matric-Tech) 2025" },
  { value: "SSC-II-TECH", label: "SSC-II (Matric-Tech) 2025" },
  { value: "SSC-I-TECH-2nd", label: "SSC-I (Matric-Tech) 2nd Annual" },
  { value: "SSC-II-TECH-2nd", label: "SSC-II (Matric-Tech) 2nd Annual" },
  { value: "HSSC-I", label: "HSSC-I (2026) 1st Annual" },
  { value: "HSSC-II", label: "HSSC-II (2026) 1st Annual" },
  { value: "HSSC-I-2nd", label: "HSSC-I 2nd Annual (2025)" },
  { value: "HSSC-II-2nd", label: "HSSC-II 2nd Annual (2025)" },
  { value: "HSSC-I-TECH", label: "HSSC-I (Inter-Tech) 1st Annual 2025" },
  { value: "HSSC-II-TECH", label: "HSSC-II (Inter-Tech) 1st Annual 2025" },
  { value: "HSSC-I-TECH-2nd", label: "HSSC-I (Inter-Tech) 2nd Annual (2025)" },
  { value: "HSSC-II-TECH-2nd", label: "HSSC-II (Inter-Tech) 2nd Annual (2025)" },
  { value: "HSSC-URDU", label: "Urdu International (Hong Kong) 2025" },
  { value: "DIPLOMA", label: "Diploma 1st Annual (2025)" },
] as const;

export const CLASS_VALUES = CLASS_OPTIONS.map((c) => c.value) as readonly string[];

export function isAllowedAsset(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "portal.fbise.edu.pk";
  } catch {
    return false;
  }
}
