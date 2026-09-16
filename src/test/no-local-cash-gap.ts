/* Guard `no-local-cash-gap` (D01, #295/#296): la brecha de caja la publica el backend.
 *
 * El frontend NO la reconstruye restando obligaciones a la caja (ni al revés), y NO publica el
 * saldo final ni el mínimo con el apellido de la brecha (D03: saldo final ≠ mínimo ≠ brecha).
 * `projected_cash_14d` ya trae los egresos comprometidos restados: volver a restarlos es doble
 * conteo, y con la caja bajo cero el resultado excede a las obligaciones.
 *
 * Este módulo es la ÚNICA lista de patrones. Cada dominio que consume la brecha (Pagar V2, Inicio)
 * tiene un test que la aplica a sus archivos productivos; la lista vive acá para que ampliarla en
 * un dominio la amplíe en todos. Tests y stories quedan fuera: fijan literales a propósito.
 *
 * Los patrones miran el texto crudo del archivo (comentarios incluidos), igual que el guard
 * original: un comentario que necesite escribir la resta la escribe con palabras ("críticas menos
 * caja") o con el signo menos tipográfico (U+2212), nunca con el guion ASCII. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Lados de la resta prohibida. Mayúsculas/minúsculas y acentos: `/i` + variantes explícitas. */
const CAJA = "(?:saldo|saldoFinal|final|proyectado|proyectada|projected|caja|cash)";
const OBLIGACIONES =
  "(?:vencimientos|criticos|críticos|criticas|críticas|critical|obligaciones|pagosCriticos|due_14d)";

export const LOCAL_CASH_GAP_PATTERNS: readonly RegExp[] = [
  /calcularBrecha/,
  /brechaResidual/,
  // obligaciones − caja y caja − obligaciones, con cualquiera de los nombres vivos en el repo
  // (`\w*` absorbe los sufijos: `critical_obligations_14d`, `projected_cash_14d`, `saldoFinal`).
  new RegExp(`\\b${OBLIGACIONES}\\w*\\s*-\\s*${CAJA}`, "i"),
  new RegExp(`\\b${CAJA}\\w*\\s*-\\s*${OBLIGACIONES}`, "i"),
  // La forma exacta que tenía `cash-gap-14d.ts` (#296): `Math.max(0, critical - projected)`.
  /Math\.max\(\s*0\s*,\s*(?:critical|criticas|críticas|obligaciones)\w*\s*-/i,
];

export interface SourceFile {
  name: string;
  source: string;
}

/** Archivos `.ts`/`.tsx` productivos (sin tests ni stories) de `dir`, recursivo si se pide. */
export function productionSources(dir: string, opts: { recursive?: boolean } = {}): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (opts.recursive) out.push(...productionSources(full, opts));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.(test|stories)\.tsx?$/.test(entry)) continue;
    out.push({ name: full, source: readFileSync(full, "utf8") });
  }
  return out;
}

/** GEMELO POSITIVO del guard: las formas que SÍ debe atrapar. Si una regex quedara muerta, el
 *  `not.toMatch` de los tests pasaría por vacío; cada test afirma que estas muestras casan. */
export const LOCAL_CASH_GAP_SAMPLES: readonly string[] = [
  "const faltante = Math.max(0, critical - projected);",
  "criticos - caja",
  "pagosCriticos - cash",
  "due_14d - projected",
  "saldo - vencimientos",
  "final - criticos",
  "proyectado - vencimientos",
  "projected_cash_14d - critical_obligations_14d",
  "critical_obligations_14d - projected_cash_14d",
];
