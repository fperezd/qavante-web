/* Helpers PUROS de Pagar v2 (buckets, subtotales por criticidad, delta de caja,
 * agrupación por proveedor). Presentación sobre datos ya entregados. Testeable. */

export type Tone = "success" | "warning" | "danger" | "neutral";
export type Criticality = "critica" | "media" | "baja";
export type DueBucket = "vencido" | "d7" | "d14" | "d30" | "mas";

export interface PagoItem {
  label: string;
  supplier: string;
  category: string;
  amount: string;
  /** Días hasta el vencimiento; negativo = vencido. */
  days_to_due: number;
  criticality: Criticality;
  due_date: string;
}

export function parseAmount(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function criticalityTone(c: Criticality): { tone: Tone; label: string } {
  switch (c) {
    case "critica":
      return { tone: "danger", label: "Crítico" };
    case "media":
      return { tone: "warning", label: "Medio" };
    case "baja":
      return { tone: "neutral", label: "Bajo" };
  }
}

/** En qué bucket temporal cae un pago según días al vencimiento. */
export function dueBucket(daysToDue: number): DueBucket {
  if (daysToDue < 0) return "vencido";
  if (daysToDue <= 7) return "d7";
  if (daysToDue <= 14) return "d14";
  if (daysToDue <= 30) return "d30";
  return "mas";
}

/** Holgura de caja a 14 días = caja proyectada − obligaciones críticas. */
export function cashDelta14d(projectedCash: string, criticalObligations: string): number {
  return parseAmount(projectedCash) - parseAmount(criticalObligations);
}

/** Suma de montos por nivel de criticidad. */
export function subtotalsByCriticality(items: PagoItem[]): Record<Criticality, number> {
  const acc: Record<Criticality, number> = { critica: 0, media: 0, baja: 0 };
  for (const it of items) acc[it.criticality] += parseAmount(it.amount);
  return acc;
}

/** Agrupa por proveedor con total, ordenado desc por monto. */
export function groupBySupplier(items: PagoItem[]): { supplier: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const cur = map.get(it.supplier) ?? { total: 0, count: 0 };
    cur.total += parseAmount(it.amount);
    cur.count += 1;
    map.set(it.supplier, cur);
  }
  return [...map.entries()]
    .map(([supplier, v]) => ({ supplier, ...v }))
    .sort((a, b) => b.total - a.total);
}
