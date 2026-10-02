import type { MovTipo } from "@/components/caja/v2/caja-cascada-model";

/* Escenario de caja de EJEMPLO para las maquetas. No extiende el tipo de la proyección
   real (`CashProjectionResponse`) a propósito: hacerlo obligaba a rellenar a mano cada
   rama del contrato con ceros y listas vacías — un objeto que se hacía pasar por una
   respuesta del servidor — y rompía en cada campo nuevo del contrato. Acá sólo viven
   los campos que las maquetas leen de verdad. */

export interface DemoProjectionMovement {
  date: string;
  label: string;
  amount: number;
  type: MovTipo;
}

export interface DemoProjectionPoint {
  fecha: string;
  saldo_cierre: string;
}

export interface DemoCashProjection {
  as_of: string;
  horizon_days: number;
  moneda: "CLP";
  /** Saldo de partida del escenario; no es un saldo bancario leído de ninguna cuenta. */
  saldo_hoy: string;
  saldo_final: string;
  minimo: string;
  en_sobregiro: boolean;
  serie: DemoProjectionPoint[];
  /** Primer día en que el escenario cae bajo la caja mínima, si ocurre. */
  punto_quiebre: { fecha: string; saldo: string } | null;
  /** Detalle del escenario: cobros y pagos de ejemplo con su fecha. */
  demo_movements: DemoProjectionMovement[];
}

const SCENARIO = [
  {
    day: 0,
    label: "Pago pendiente · servicio de internet",
    amount: -45_000,
    type: "otro",
  },
  {
    day: 0,
    label: "Cobro esperado · servicio de soporte",
    amount: 320_000,
    type: "cobranza",
  },
  {
    day: 0,
    label: "Pago pendiente · cuenta de electricidad",
    amount: -68_000,
    type: "otro",
  },
  {
    day: 3,
    label: "Cobro programado · nuevo servicio a cliente",
    amount: 1_190_000,
    type: "cobranza",
  },
  { day: 5, label: "Reposición de inventario · proveedores", amount: -476_000, type: "proveedor" },
  { day: 8, label: "Remuneraciones del período", amount: -850_000, type: "sueldos" },
  { day: 12, label: "Arriendo y servicios", amount: -320_000, type: "otro" },
  { day: 17, label: "Cotizaciones previsionales · Previred", amount: -180_000, type: "sueldos" },
  { day: 27, label: "IVA del F29", amount: -66_500, type: "impuesto" },
  {
    day: 42,
    label: "Cobro programado · proyecto para cliente",
    amount: 1_500_000,
    type: "cobranza",
  },
  {
    day: 45,
    label: "Compra proyectada de insumos · proveedores",
    amount: -600_000,
    type: "proveedor",
  },
  { day: 84, label: "Servicios y licencias", amount: -420_000, type: "otro" },
] as const satisfies ReadonlyArray<{
  day: number;
  label: string;
  amount: number;
  type: MovTipo;
}>;

const CASH_MINIMUM = 3_000_000;

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOffset(asOf: Date, days: number): Date {
  const date = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

function scenarioPath(events: DemoProjectionMovement[], openingBalance: number) {
  let balance = openingBalance;
  return events.map((event) => {
    balance += event.amount;
    return { fecha: event.date, saldo_cierre: String(balance), capa: "esperado" };
  });
}

export function buildDemoCashProjection(
  horizonDays: number,
  openingBalance: number,
  asOf = new Date(),
  includeCollections = true,
): DemoCashProjection {
  const asOfDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const events: DemoProjectionMovement[] = SCENARIO.filter(
    (item) => item.day <= horizonDays && (includeCollections || item.amount < 0),
  ).map((item) => ({
    date: isoDate(dateOffset(asOfDate, item.day)),
    label: item.label,
    amount: item.amount,
    type: item.type,
  }));
  const series = scenarioPath(events, openingBalance);
  const saldoFinal =
    series.length > 0 ? Number(series[series.length - 1]?.saldo_cierre) : openingBalance;
  const breakPoint = series.find((point) => Number(point.saldo_cierre) < CASH_MINIMUM);

  return {
    as_of: isoDate(asOfDate),
    horizon_days: horizonDays,
    moneda: "CLP",
    saldo_hoy: String(openingBalance),
    saldo_final: String(saldoFinal),
    minimo: String(CASH_MINIMUM),
    en_sobregiro: openingBalance < CASH_MINIMUM,
    serie: series,
    punto_quiebre: breakPoint ? { fecha: breakPoint.fecha, saldo: breakPoint.saldo_cierre } : null,
    demo_movements: events,
  };
}
