/* Mapper PURO del Caja v2 live (sin React): deriva la serie de la curva de saldo desde el
   saldo de hoy + los netos del reporte de caja, y la caja mínima (CLP) desde el endpoint
   cash-minimum. El backend aún NO manda running_balance/min_cash en el cash-flow (brecha
   abierta), así que el FE los deriva; cuando lleguen, se usan directo. Montos string-decimal
   → `parseAmount`. */

import { parseAmount } from "@/components/inicio/dashboard-format";
import { weekMondayFrom } from "@/components/caja/cash-flow-format";
import { formatMoney } from "@/lib/formatters/clp";
import { saldoAcumulado, type SaldoPunto } from "./caja-curva-model";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un período del cash-flow: `2026-07-14`→`14-jul`, `2026-07`→`jul`. */
export function labelBucketCorto(period: string): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(period);
  if (dm) return `${dm[3]}-${MESES[Number(dm[2]) - 1] ?? dm[2]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return MESES[Number(m[2]) - 1] ?? period;
  return period;
}

/** Serie de saldo proyectado = saldo de hoy + los netos por bucket, acumulados. El primer
 *  punto es "hoy" (saldo inicial); cada bucket mueve el saldo por su neto. */
export function serieDesdeCashFlow(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  label: (period: string) => string = labelBucketCorto,
): SaldoPunto[] {
  const netos = buckets.map((b) => parseAmount(b.net));
  const acum = saldoAcumulado(saldoHoy, netos);
  return [
    { label: "hoy", saldo: saldoHoy },
    ...buckets.map((b, i) => ({ label: label(b.period), saldo: acum[i] ?? saldoHoy })),
  ];
}

type CFGranularity = "week" | "month" | "day";

/** Fin (exclusivo) del bucket según la granularidad. `null` si el `period` no matchea el formato. */
function bucketFin(period: string, granularity: CFGranularity): Date | null {
  if (granularity === "week") {
    const m = weekMondayFrom(period);
    return m ? new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7) : null;
  }
  if (granularity === "month") {
    const mm = /^(\d{4})-(\d{2})$/.exec(period);
    return mm ? new Date(Number(mm[1]), Number(mm[2]), 1) : null; // 1° del mes siguiente
  }
  const dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  return dd ? new Date(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3]) + 1) : null;
}

/** ¿El bucket ya terminó ANTES de `now`? Se usa para proyectar SOLO desde hoy hacia adelante:
 *  un bucket cuyo período ya pasó no debe re-aplicarse al saldo de hoy (ese flujo ya está dentro
 *  del saldo → doble conteo). No parseable → false (no lo descartamos). */
export function bucketPasado(period: string, granularity: CFGranularity, now: Date): boolean {
  const fin = bucketFin(period, granularity);
  return fin != null && fin <= now;
}

/** Inicio (inclusivo) del bucket según la granularidad. `null` si el `period` no matchea el formato. */
function bucketInicio(period: string, granularity: CFGranularity): Date | null {
  if (granularity === "week") return weekMondayFrom(period);
  if (granularity === "month") {
    const mm = /^(\d{4})-(\d{2})$/.exec(period);
    return mm ? new Date(Number(mm[1]), Number(mm[2]) - 1, 1) : null;
  }
  const dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  return dd ? new Date(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3])) : null;
}

/** ¿El bucket ya EMPEZÓ (su inicio es <= `now`)? El bucket EN CURSO (empezó pero no terminó) da true.
 *  Se usa para ANCLAR la serie en el saldo de hoy sin doble contar el tramo ya transcurrido: el saldo
 *  de hoy YA incluye lo que va del bucket en curso, así que el ancla es ese bucket (no el último ya
 *  cerrado). No parseable → false. */
export function bucketEmpezado(period: string, granularity: CFGranularity, now: Date): boolean {
  const inicio = bucketInicio(period, granularity);
  return inicio != null && inicio <= now;
}

/** Filtra los buckets del reporte a los que NO terminaron antes de hoy: la proyección arranca
 *  DESDE HOY, no desde el inicio del período. Evita el doble conteo de buckets pasados. */
export function bucketsDesdeHoy(
  buckets: CashFlowBucket[],
  granularity: CFGranularity = "week",
  now: Date = new Date(),
): CashFlowBucket[] {
  return buckets.filter((b) => !bucketPasado(b.period, granularity, now));
}

/** Suma entra/sale/neto de una lista de buckets — para recomputar el flujo del período tras
 *  filtrar a futuro (el `grand_total` del backend suma TODOS los buckets, incluidos los pasados). */
export function flujoDeBuckets(buckets: CashFlowBucket[]): {
  entra: number;
  sale: number;
  neto: number;
} {
  let entra = 0;
  let sale = 0;
  let neto = 0;
  for (const b of buckets) {
    entra += parseAmount(b.total_inflow);
    sale += parseAmount(b.total_outflow);
    neto += parseAmount(b.net);
  }
  return { entra, sale, neto };
}

/** Serie del saldo ANCLADA en el saldo de hoy, sobre TODOS los buckets del rango. Reconstruye el
 *  saldo al cierre de cada período. El ANCLA es el bucket EN CURSO (el que contiene hoy): el saldo de
 *  hoy YA incluye lo que va de ese bucket, así que su punto ES el saldo de hoy — NO se le vuelve a
 *  sumar el neto del período en curso (eso duplicaba el tramo ya transcurrido, #735). Los períodos
 *  anteriores se reconstruyen hacia atrás y los futuros se proyectan hacia adelante. Un punto por
 *  bucket (cierre del período). */
export function serieAnclada(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  granularity: CFGranularity,
  now: Date,
  label: (period: string) => string,
): SaldoPunto[] {
  if (buckets.length === 0) return [];
  // Cumulativo de netos desde el inicio del rango.
  const cum: number[] = [];
  let acc = 0;
  for (const b of buckets) {
    acc += parseAmount(b.net);
    cum.push(acc);
  }
  // Ancla = último bucket que YA EMPEZÓ (el EN CURSO, que contiene hoy; o el último cerrado si el rango
  // no llega a hoy). Su cumulativo mapea al saldo de hoy → el bucket en curso cierra en el saldo de hoy
  // (no en saldo+neto), sin doble contar el tramo transcurrido (#735). Si todos son futuros (-1), el
  // ancla es 0 → todo se proyecta desde el saldo de hoy.
  let anchor = -1;
  buckets.forEach((b, i) => {
    if (bucketEmpezado(b.period, granularity, now)) anchor = i;
  });
  const base = anchor >= 0 ? (cum[anchor] ?? 0) : 0;
  const offset = saldoHoy - base;
  return buckets.map((b, i) => ({ label: label(b.period), saldo: (cum[i] ?? 0) + offset }));
}

/** Índice del primer período NO pasado cuyo saldo cae ESTRICTAMENTE bajo el mínimo — el cruce
 *  ACCIONABLE. La serie anclada reconstruye períodos pasados; un dip reconstruido en una semana
 *  que ya terminó NO es un cruce a advertir ("adelanta una cobranza" no aplica al pasado). Solo
 *  cuenta de hoy en adelante. `null` si no hay mínimo o no hay cruce futuro. */
export function primerCruceFuturo(
  serie: SaldoPunto[],
  buckets: CashFlowBucket[],
  granularity: CFGranularity,
  now: Date,
  minimo: number | null,
): number | null {
  if (minimo == null) return null;
  for (let i = 0; i < serie.length; i++) {
    const b = buckets[i];
    if (b && bucketPasado(b.period, granularity, now)) continue; // ignora los períodos ya pasados
    if ((serie[i]?.saldo ?? Number.POSITIVE_INFINITY) < minimo) return i;
  }
  return null;
}

/** Caja mínima en CLP desde el endpoint cash-minimum, o `null` si no hay umbral CLP. */
export function cajaMinimoCLP(cm: CashMinimumResponse | undefined): number | null {
  const t = (cm?.thresholds ?? []).find((x) => (x.currency_code ?? "").toUpperCase() === "CLP");
  return t ? parseAmount(t.amount) : null;
}

/* ── Completitud del flujo del período (INV-FX-001) ─────────────────────────────────────── */

/** Porción de ingreso sin clasificar a partir de la cual el flujo "committed" miente por omisión. */
export const UMBRAL_SIN_CLASIFICAR = 0.2;

/** Veredicto sobre si el flujo clasificado del período es representativo:
 *  - `completo`: lo sin clasificar es marginal → mostrar Entra/Sale.
 *  - `incompleto`: falta clasificar una porción material → NO mostrar el parcial.
 *  - `indeterminado`: no se puede saber SIN convertir moneda extranjera, y convertir
 *    (elegir tasa y fecha) es decisión humana → se declara, no se adivina. */
export type CompletitudFlujo = "completo" | "incompleto" | "indeterminado";

/** Lo que necesita el veredicto del resumen de sin-clasificar (subset de `UnclassifiedSummary`). */
export interface SinClasificarInput {
  count: number;
  inflowByCurrency: { currency: string; inflow: number; count: number }[];
  unknownInflowCount: number;
}

/** Entradas sin clasificar EN PESOS (solo las de cuentas CLP). Nunca mezcla monedas. */
export function entradasSinClasificarCLP(sc: SinClasificarInput | undefined): number {
  return sc?.inflowByCurrency.find((c) => c.currency === "CLP")?.inflow ?? 0;
}

/** ¿Hay entradas sin clasificar que NO son pesos (otra moneda, o moneda desconocida)? */
export function haySinClasificarNoCLP(sc: SinClasificarInput | undefined): boolean {
  if (!sc) return false;
  if (sc.unknownInflowCount > 0) return true;
  return sc.inflowByCurrency.some((c) => c.currency !== "CLP" && c.inflow > 0);
}

/** ¿El flujo clasificado del período es representativo? PURO.
 *
 *  `entra` viene del cash-flow report, que ya llega en moneda FUNCIONAL (CLP) — el backend
 *  convierte. Lo sin clasificar, en cambio, son montos CRUDOS en la moneda de cada cuenta, así
 *  que solo la porción CLP es comparable contra `entra` sin tipo de cambio.
 *
 *  El veredicto usa esa porción CLP como COTA INFERIOR: `r(U) = U / (entra + U)` crece con `U`,
 *  y el `U` real (con lo extranjero convertido) es ≥ el `U` en CLP. Entonces:
 *  - si ya la cota supera el umbral ⇒ `incompleto` con certeza, sin convertir nada;
 *  - si no la supera pero hay entradas en otra moneda (o de moneda desconocida) ⇒ NO se puede
 *    concluir: `indeterminado`. Antes esto se resolvía sumando USD como si fueran pesos, lo que
 *    contaminaba una decisión que el usuario ve (violación INV-FX-001). */
export function completitudFlujo(
  entra: number,
  sc: SinClasificarInput | undefined,
): CompletitudFlujo {
  if (!sc || sc.count <= 0) return "completo";
  const clp = entradasSinClasificarCLP(sc);
  const baseEntra = Number.isFinite(entra) ? Math.max(entra, 0) : 0;
  const total = baseEntra + clp;
  if (total > 0 && clp / total > UMBRAL_SIN_CLASIFICAR) return "incompleto";
  return haySinClasificarNoCLP(sc) ? "indeterminado" : "completo";
}

/** Entradas sin clasificar formateadas UNA POR MONEDA ("$61.500.000 · US$1.200,00"), nunca
 *  sumadas entre sí. `null` si no hay entradas con moneda conocida. */
export function entradasSinClasificarLabel(sc: SinClasificarInput | undefined): string | null {
  const partes = (sc?.inflowByCurrency ?? [])
    .filter((c) => c.inflow > 0)
    .map((c) => formatMoney(c.inflow, c.currency));
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Por qué no se puede determinar la completitud. `null` si sí se puede. Nombra las monedas:
 *  el usuario tiene que entender que no es un bug, es que falta una decisión (el tipo de cambio). */
export function motivoIndeterminado(sc: SinClasificarInput | undefined): string | null {
  if (!sc || !haySinClasificarNoCLP(sc)) return null;
  const otras = sc.inflowByCurrency
    .filter((c) => c.currency !== "CLP" && c.inflow > 0)
    .map((c) => c.currency);
  const sinMoneda = sc.unknownInflowCount;
  const trozos: string[] = [];
  if (otras.length > 0) trozos.push(`en ${otras.join(" y ")}`);
  if (sinMoneda > 0) {
    trozos.push(
      `de ${sinMoneda} ${sinMoneda === 1 ? "movimiento" : "movimientos"} cuya moneda no conocemos`,
    );
  }
  return `Hay entradas sin clasificar ${trozos.join(" y ")}. No las convertimos a pesos: el tipo de cambio (tasa y fecha) lo eliges tú, no lo inventamos.`;
}
