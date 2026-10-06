/* Utilidades puras para leer las respuestas de la API con mirada financiera. NO es un spec. */

/** "18500000" / "-7400000.50" / "$1.234" → número. `null` si no viene o no es numérico. */
export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/−/g, "-").trim();
  // Decimal de la API ("1234.50"): punto como separador decimal, sin miles.
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // Texto es-CL ("$1.234.567" / "US$ 5.862,30"): punto de miles, coma decimal.
  const limpio = s
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpio);
  return limpio && Number.isFinite(n) ? n : null;
}

export function num(v: unknown): number {
  return numOrNull(v) ?? 0;
}

/** Monto en formato es-CL para los mensajes de falla ("$69.416.353" / "US$ 5.862,30"). */
export function clp(n: number | null | undefined, currency = "CLP"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "sin dato";
  const cur = (currency || "CLP").toUpperCase();
  if (cur === "CLP") {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function entero(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

/** RUT normalizado: sin puntos ni guion, DV en mayúscula ("76008959-1" → "760089591"). */
export function normalizarRut(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const limpio = rut.replace(/[.\-\s]/g, "").toUpperCase();
  return /^\d{7,8}[\dK]$/.test(limpio) ? limpio.replace(/^0+/, "") : null;
}

/** RUTs que aparecen en una glosa bancaria ("76.008.959-1", "76008959-1", "0760089591"). */
export function rutsEnTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const out = new Set<string>();
  const re = /\b(\d{1,2}\.?\d{3}\.?\d{3})\s?-\s?([\dkK])\b/g;
  for (const m of texto.matchAll(re)) {
    const r = normalizarRut(`${m[1]}${m[2]}`);
    if (r && dvValido(r)) out.add(r);
  }
  return [...out];
}

/** Dígito verificador módulo 11: descarta números de operación que parecen RUT. */
export function dvValido(rutNormalizado: string): boolean {
  const cuerpo = rutNormalizado.slice(0, -1);
  const dv = rutNormalizado.slice(-1);
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  const esperado = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return esperado === dv;
}

/** Fecha civil de hoy en Chile (`YYYY-MM-DD`), independiente del huso del runner. */
export function hoySantiago(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** `YYYY-MM-DD` de un instante ISO en hora de Chile. */
export function fechaSantiago(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return hoySantiago(d);
}

/** Días civiles entre dos `YYYY-MM-DD` (`b − a`). */
export function diasEntre(a: string, b: string): number {
  const ua = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const ub = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((ub - ua) / 86_400_000);
}

/** Glosa comparable para detectar duplicados (mayúsculas, sin espacios repetidos). */
export function glosaNormalizada(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Formas de voseo con tilde final (las que no son ambiguas con el tuteo: "Reconectá", "intentá"). */
export const VOSEO_TILDE =
  /\b(reconectá|intentá|conectá|revisá|volvé|probá|elegí|ingresá|definí|esperá|actualizá|hacé|tenés|podés|querés|sabés|recordá|poné|confirmá|cargá|subí)\b/i;

/** Jerga interna que no debe verse en la UI. */
export const JERGA_INTERNA =
  /(sembrar sesi[oó]n|PolicyConstraint|sin_version|v14_scope_authority_unavailable|credential_not_usable|bice_session_unavailable|proyecci[oó]n can[oó]nica)/i;
