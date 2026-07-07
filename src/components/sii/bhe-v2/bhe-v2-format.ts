/* Helpers PUROS del panel BHE (retención + concentración por profesional).
 * Presentación sobre las boletas ya descargadas. Las ANULADAS no cuentan (la
 * retención se revierte al anular) — igual que el footer de la vista. Testeable. */

import type { BheRecibida } from "@/lib/api/sii";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export interface BheTotals {
  bruto: number;
  retencion: number;
  liquido: number;
  count: number;
}

export function bheTotals(items: BheRecibida[]): BheTotals {
  return items.reduce<BheTotals>(
    (acc, b) =>
      b.anulada
        ? acc
        : {
            bruto: acc.bruto + num(b.monto_bruto),
            retencion: acc.retencion + num(b.retencion),
            liquido: acc.liquido + num(b.monto_liquido),
            count: acc.count + 1,
          },
    { bruto: 0, retencion: 0, liquido: 0, count: 0 },
  );
}

export interface EmisorShare {
  rut: string;
  name: string;
  liquido: number;
  pct: number;
}

/** Top profesionales por líquido pagado (excluye anuladas). Clave por RUT; sin
 *  RUT, por nombre — para no fundir profesionales distintos en un bucket "—". */
export function concentrationByEmisor(items: BheRecibida[], topN = 5): EmisorShare[] {
  const map = new Map<string, { rut: string; name: string; liquido: number }>();
  let grand = 0;
  for (const b of items) {
    if (b.anulada) continue;
    const key = b.rut_emisor ?? b.nombre_emisor ?? "sin-identificar";
    const l = num(b.monto_liquido);
    grand += l;
    const cur = map.get(key) ?? {
      rut: b.rut_emisor ?? "—",
      name: b.nombre_emisor ?? "Sin nombre",
      liquido: 0,
    };
    cur.liquido += l;
    map.set(key, cur);
  }
  const denom = grand || 1;
  return [...map.values()]
    .filter((v) => v.liquido > 0)
    .map((v) => ({ rut: v.rut, name: v.name, liquido: v.liquido, pct: (v.liquido / denom) * 100 }))
    .sort((a, b) => b.liquido - a.liquido)
    .slice(0, topN);
}
