/* Helpers PUROS del panel BHE v2 (retención + concentración por profesional).
 * Presentación sobre boletas ya descargadas. Testeable. */

export interface BheItem {
  fecha_emision?: string;
  nombre_emisor?: string;
  rut_emisor?: string;
  folio?: number;
  monto_bruto?: number;
  retencion?: number;
  monto_liquido?: number;
}

function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export interface BheTotals {
  bruto: number;
  retencion: number;
  liquido: number;
  count: number;
}

export function bheTotals(items: BheItem[]): BheTotals {
  return items.reduce<BheTotals>(
    (acc, b) => ({
      bruto: acc.bruto + num(b.monto_bruto),
      retencion: acc.retencion + num(b.retencion),
      liquido: acc.liquido + num(b.monto_liquido),
      count: acc.count + 1,
    }),
    { bruto: 0, retencion: 0, liquido: 0, count: 0 },
  );
}

export interface EmisorShare {
  rut: string;
  name: string;
  liquido: number;
  pct: number;
}

/** Top profesionales por líquido pagado. */
export function concentrationByEmisor(items: BheItem[], topN = 5): EmisorShare[] {
  const map = new Map<string, { name: string; liquido: number }>();
  let grand = 0;
  for (const b of items) {
    const rut = b.rut_emisor ?? "—";
    const l = num(b.monto_liquido);
    grand += l;
    const cur = map.get(rut) ?? { name: b.nombre_emisor ?? "Sin nombre", liquido: 0 };
    cur.liquido += l;
    map.set(rut, cur);
  }
  const denom = grand || 1;
  return [...map.entries()]
    .map(([rut, v]) => ({ rut, name: v.name, liquido: v.liquido, pct: (v.liquido / denom) * 100 }))
    .sort((a, b) => b.liquido - a.liquido)
    .slice(0, topN);
}
