/* Mapper PURO del modelo ÚNICO de caja (contrato #770 / ADR-0085): traduce la `CashProjectionResponse`
   del backend al `DiasCaja` que consume el medidor + las causas del punto de quiebre. Es el reemplazo
   de la REPROYECCIÓN del FE (`caja-proyeccion-model`) para el medidor/curva: el número de días de caja,
   el piso y el punto de quiebre pasan a ser los del backend (una sola fuente de verdad; adiós a las
   "3 respuestas distintas a ¿cuánta caja tengo?"). La cascada de próximos movimientos sigue derivándose
   del maestro (el backend aún no expone el detalle por-movimiento). Sin React, testeable. */

import type { CashProjectionResponse } from "@/lib/api/treasury";
import { parseAmount } from "@/components/gestion/gestion-format";
import { formatDateLike } from "@/lib/formatters/date";
import type { DiasCaja, EstadoCaja } from "./caja-dias-model";
import type { CausaQuiebre } from "./caja-proyeccion-model";

/** Días entre dos fechas ISO "YYYY-MM-DD" (a mediodía UTC para evitar drift por DST). */
function diasEntreISO(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T12:00:00Z`);
  const b = Date.parse(`${toISO}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

interface Punto {
  dia: number;
  saldo: number;
}

/** Primer día en que el saldo cae bajo `umbral`; `null` si nunca cruza en la serie. */
function primerCruce(puntos: Punto[], umbral: number): number | null {
  for (const p of puntos) if (p.saldo < umbral) return p.dia;
  return null;
}

/** Días hasta volver ≥ `minima` DESPUÉS del día del piso; `null` si no se recupera. */
function recuperacion(puntos: Punto[], pisoDia: number, minima: number): number | null {
  for (const p of puntos) if (p.dia > pisoDia && p.saldo >= minima) return p.dia;
  return null;
}

/** `CashProjectionResponse` → `DiasCaja` para el medidor. `null` (⇒ "sin dato") si no hay serie:
 *  nunca inventamos una curva. Días de caja, piso y punto de quiebre son AUTORITATIVOS del backend. */
export function cashProjectionToDiasCaja(
  resp: CashProjectionResponse | undefined,
): DiasCaja | null {
  const serie = resp?.serie ?? [];
  if (!resp || serie.length === 0) return null;

  const saldoHoy = parseAmount(resp.saldo_hoy);
  const minima = parseAmount(resp.minimo);
  const asOf = resp.as_of;

  // Curva = hoy (día 0) + la serie del backend a cierre de día (con su fecha real, no índice uniforme).
  const puntos: Punto[] = [
    { dia: 0, saldo: saldoHoy },
    ...serie.map((p) => ({ dia: diasEntreISO(asOf, p.fecha), saldo: parseAmount(p.saldo_cierre) })),
  ];

  // Piso = el punto de quiebre del backend (el que trae causas); si no hay, el mínimo de la serie.
  const pq = resp.punto_quiebre;
  const piso: Punto = pq
    ? { saldo: parseAmount(pq.saldo), dia: diasEntreISO(asOf, pq.fecha) }
    : puntos.reduce((lo, p) => (p.saldo < lo.saldo ? p : lo), puntos[0]!);

  const minSaldo = Math.min(...puntos.map((p) => p.saldo));
  const estado: EstadoCaja = minSaldo < 0 ? "critico" : minSaldo < minima ? "ajustado" : "sano";

  return {
    saldoHoy,
    // Días de caja AUTORITATIVO del backend (fuente única); si viniera null, se deriva de la serie.
    diasHastaMinimo: resp.dias_de_caja ?? primerCruce(puntos, minima),
    diasHastaCero: primerCruce(puntos, 0),
    piso: { saldo: piso.saldo, dia: piso.dia },
    diasRecuperacion: recuperacion(puntos, piso.dia, minima),
    horizonteDias: resp.horizon_days ?? puntos[puntos.length - 1]?.dia ?? 0,
    estado,
  };
}

/** Tipo de causa del backend (`'pago' | 'f29' | 'pago_vencido'`) → el `MovTipo` del badge de la
 *  cascada. F29 es impuesto; el resto es un pago genérico ("otro" se rotula "Pago" en la vista). */
function mapCausaTipo(tipo: string | null | undefined): CausaQuiebre["tipo"] {
  if (tipo === "f29") return "impuesto";
  if (tipo === "pago" || tipo === "pago_vencido") return "otro";
  return undefined;
}

/** Causas del punto de quiebre del backend → `CausaQuiebre[]` (mayores egresos que hunden la caja).
 *  Cada causa lleva SU propia fecha (ADR-0087 Ask 2: el día en que ese egreso impacta la caja) — no la
 *  del quiebre para todas; si el backend no la trae, cae a la del quiebre. También mapea el `tipo` para
 *  el badge (Impuesto/Pago). */
export function causasFromCashProjection(resp: CashProjectionResponse | undefined): CausaQuiebre[] {
  const pq = resp?.punto_quiebre;
  if (!pq?.causas || pq.causas.length === 0) return [];
  return pq.causas.map((c) => ({
    label: c.glosa,
    monto: parseAmount(c.monto),
    fechaLabel: formatDateLike(c.fecha ?? pq.fecha),
    tipo: mapCausaTipo(c.tipo),
  }));
}

/** Un cobro por-cobrar vencido o sin fecha (los que el runway NO cuenta). */
export interface CobroVencido {
  glosa: string;
  monto: number;
  /** Días de atraso (>0), o `null` si es "sin fecha de pago". */
  diasAtraso: number | null;
}

/** Escenario "con recuperación del atraso" (ADR-0087): si el por-cobrar-vencido se cobra repartido en
 *  N días, cuál es el PISO (punto de quiebre) resultante — la respuesta honesta al "sin recuperación"
 *  del core (que lo excluye). NO pisa los números core: es un escenario aparte. Usamos el PISO (no los
 *  días de caja) porque es la mejora que importa: validado al peso, la recuperación baja el piso de
 *  −$49M a −$3,6M aunque el runway inmediato siga en 1 día (los pagos son muy al inicio). */
export interface RecuperacionAtraso {
  /** Piso (punto de quiebre) SI se recupera el atraso, o `null` si el escenario no toca la mínima. */
  pisoRecup: number | null;
  /** Σ del por-cobrar-vencido que se recupera. */
  totalRecuperado: number;
  /** Ventana de reparto (días; N=30). */
  ventanaDias: number;
}

/** `esperado_con_recuperacion` → `RecuperacionAtraso`, o `null` si no hay recuperación material
 *  (total 0 → no hay atraso que cobrar, no mostramos el escenario). */
export function recuperacionAtraso(
  resp: CashProjectionResponse | undefined,
): RecuperacionAtraso | null {
  const ec = resp?.esperado_con_recuperacion;
  if (!ec) return null;
  const totalRecuperado = parseAmount(ec.total_recuperado);
  if (totalRecuperado <= 0) return null;
  return {
    pisoRecup: ec.punto_quiebre ? parseAmount(ec.punto_quiebre.saldo) : null,
    totalRecuperado,
    ventanaDias: ec.recuperacion_days,
  };
}

/** Los COBROS vencidos/sin-fecha del `vencido` del backend (los mismos que suma `por_cobrar_vencido`):
 *  la lista que el dueño puede revisar/conciliar. Filtra los PAGOS (tipo `pago_vencido`), que no son
 *  por-cobrar. Ordena por monto desc. Puro. */
export function cobrosPorCobrarVencido(resp: CashProjectionResponse | undefined): CobroVencido[] {
  const items = resp?.vencido?.items ?? [];
  return items
    .filter((i) => (i.tipo ?? "").startsWith("cobro"))
    .map((i) => ({
      glosa: i.glosa,
      monto: parseAmount(i.monto),
      diasAtraso: typeof i.dias_atraso === "number" ? i.dias_atraso : null,
    }))
    .sort((a, b) => b.monto - a.monto);
}
