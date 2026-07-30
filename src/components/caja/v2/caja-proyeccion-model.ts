/* Modelo PURO de la proyección de caja FORWARD (sin React → testeable). La proyección NO sale del
   cash-flow histórico (que no proyecta el futuro) sino de los VENCIMIENTOS DERIVADOS: cobranzas
   esperadas (facturas de venta con su vencimiento derivado, del maestro AR) + obligaciones
   (proveedores/honorarios del maestro AP + F29/Previred/sueldos con su fecha). Cada doc no pagado
   se vuelve un movimiento futuro; el acumulado sobre `cash_today` da el "días de caja" del medidor
   y los pasos de la cascada. Validación real 2026-07-20: el cash-flow de Tooxs es histórico (25
   buckets ene→hoy) sin futuro → la proyección tiene que venir de acá. Ver caja-v3 memory. */

import {
  daysBetween,
  addDays,
  parseSiiDate,
  type ContraparteMaestro,
} from "@/components/terminos/terminos-pago";
import { parseAmount } from "@/components/inicio/dashboard-format";
import type { MovimientoCaja, MovTipo } from "./caja-cascada-model";
import type { DiasCaja, EstadoCaja } from "./caja-dias-model";
import type { PayableItem } from "@/lib/api/pagos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de una fecha para el eje: `14-jul`. */
export function fechaCortaLabel(d: Date): string {
  return `${d.getDate()}-${MESES[d.getMonth()] ?? ""}`;
}

/** Rango legible de una semana: `21–27 jul` (mismo mes) o `28 jul–3 ago` (cruza mes). Se usa en la
 *  cascada para que "Esta semana" muestre el RANGO y no un día suelto que coincide con "hoy". */
export function rangoSemanaLabel(start: Date, end: Date): string {
  const m1 = MESES[start.getMonth()] ?? "";
  const m2 = MESES[end.getMonth()] ?? "";
  if (m1 === m2) return `${start.getDate()}–${end.getDate()} ${m2}`;
  return `${start.getDate()} ${m1}–${end.getDate()} ${m2}`;
}

/** Fecha efectiva del movimiento DENTRO de la ventana [hoy − gracia, hoy + horizonte], o `null` si
 *  cae fuera. Un vencimiento futuro va en su fecha; uno past-due DENTRO de la gracia se trata como
 *  "hoy" (aún pendiente); uno past-due MÁS VIEJO que la gracia se EXCLUYE — casi seguro ya pagado
 *  (ya está reflejado en el cash_today) y contarlo de nuevo duplicaría plata ya gastada. Validación
 *  real Tooxs 2026-07-21: sin este filtro, ~$37M de compras viejas ya pagadas inflaban el piso a
 *  −$43M irreal. PURO. */
function fechaEnVentana(
  vencimiento: Date,
  hoy: Date,
  graceDias: number,
  horizonteDias: number,
): Date | null {
  const d = daysBetween(hoy, vencimiento);
  if (d < -graceDias || d > horizonteDias) return null;
  return d < 0 ? hoy : vencimiento;
}

/** Vencimiento efectivo más temprano de una contraparte dentro de la ventana [hoy − gracia,
 *  hoy + horizonte]: el primer doc NO pagado y NO nota de crédito cuyo vencimiento cae en la
 *  ventana. `null` si ninguno cae (todo past-due más viejo que la gracia, o todo fuera del horizonte). */
function primerVencimientoEnVentana(
  cp: ContraparteMaestro,
  hoy: Date,
  graceDias: number,
  horizonteDias: number,
): Date | null {
  let best: Date | null = null;
  for (const doc of cp.docs) {
    if (doc.pagado || doc.esNotaCredito || doc.vencimiento == null) continue;
    const efec = fechaEnVentana(doc.vencimiento, hoy, graceDias, horizonteDias);
    if (efec == null) continue;
    if (best == null || efec.getTime() < best.getTime()) best = efec;
  }
  return best;
}

/** Movimientos forward de un maestro (cobranzas o pagos): UNO por contraparte = su neto pendiente
 *  (`total − pagado`, que ya netea TODAS las notas de crédito —vinculadas y huérfanas—), colocado en
 *  su vencimiento más temprano en la ventana [hoy − gracia, hoy + horizonte]. `signo` +1 = cobranza
 *  (entra), −1 = pago (sale).
 *
 *  Antes se emitía UN movimiento por documento con `signo * doc.monto`: eso inflaba la caja porque una
 *  NC de compra (monto negativo × −1) aparecía como ENTRADA positiva, y si la factura ya estaba pagada
 *  la NC huérfana quedaba como ingreso falso (caso real Tooxs: TD Synnex +$26,8M fantasma → cascada
 *  +$38M irreal y medidor demasiado optimista). Netear por contraparte lo elimina.
 *
 *  `graceDias` acota el past-due que se incluye (default 0 = solo futuro; el past-due viejo ya está en
 *  el cash_today). Si el neto es real pero ningún vencimiento cae en la ventana, la contraparte se omite. */
export function movimientosDeMaestro(
  cps: ContraparteMaestro[],
  signo: 1 | -1,
  tipo: MovTipo,
  hoy: Date,
  horizonteDias: number,
  graceDias = 0,
): MovimientoCaja[] {
  const out: MovimientoCaja[] = [];
  for (const cp of cps) {
    const neto = cp.total - cp.pagado; // pendiente real (NC ya neteadas); ≤0 = nada por cobrar/pagar
    if (neto <= 0) continue;
    const efectiva = primerVencimientoEnVentana(cp, hoy, graceDias, horizonteDias);
    if (efectiva == null) continue;
    out.push({
      fecha: efectiva,
      fechaLabel: fechaCortaLabel(efectiva),
      label: cp.name,
      monto: signo * neto,
      tipo,
    });
  }
  return out;
}

function tipoDeCategoria(cat: PayableItem["category"] | undefined): MovTipo {
  if (cat === "tax") return "impuesto";
  if (cat === "payroll") return "sueldos";
  if (cat === "supplier") return "proveedor";
  return "otro";
}

/** Movimientos forward de las obligaciones desde accounts-payable (F29/Previred/sueldos/arriendo…):
 *  cada item con `due_date` en la ventana [hoy − gracia, hoy + horizonte] → un pago (outflow). Se le
 *  pasan SOLO los ítems que no vienen del maestro (categoría ≠ supplier) para no doble-contar. El
 *  past-due viejo se excluye (ya pagado, ya en el cash_today). */
export function movimientosDeObligaciones(
  items: PayableItem[],
  hoy: Date,
  horizonteDias: number,
  graceDias = 0,
): MovimientoCaja[] {
  const out: MovimientoCaja[] = [];
  for (const it of items) {
    if (!it.due_date) continue;
    // El due_date es date-only ISO ("YYYY-MM-DD"). `new Date(str)` lo parsea como UTC medianoche
    // y `daysBetween` lee componentes LOCALES → en Chile (UTC negativo) la obligación caía un día
    // antes (todas: F29/sueldos/arriendo/deuda). Se usa el parser LOCAL del maestro (consistente
    // con `addDays`/`buildMaestro`, que ya son fechas locales).
    const venc = parseSiiDate(it.due_date);
    if (!venc) continue;
    const efectiva = fechaEnVentana(venc, hoy, graceDias, horizonteDias);
    if (efectiva == null) continue;
    const monto = -Math.abs(parseAmount(it.amount)); // outflow
    if (monto === 0) continue;
    out.push({
      fecha: efectiva,
      fechaLabel: fechaCortaLabel(efectiva),
      label: it.label,
      monto,
      tipo: tipoDeCategoria(it.category),
    });
  }
  return out;
}

/** Proyección DATE-AWARE: corre el saldo desde `cash_today` sobre los movimientos (ordenados por
 *  fecha) y calcula los días (fecha real, no índice) hasta cruzar la mínima/$0, el piso y la
 *  recuperación. Devuelve el shape `DiasCaja` (lo consume `CajaMedidor`). `null` si no hay
 *  movimientos → el caller muestra el estado honesto. */
export function proyeccionDeMovimientos(
  cashToday: number,
  movimientos: MovimientoCaja[],
  hoy: Date,
  minimo: number | null,
): DiasCaja | null {
  if (movimientos.length === 0) return null;
  const ref = minimo ?? 0;
  const ord = [...movimientos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  let saldo = cashToday;
  let diasHastaMinimo: number | null = cashToday < ref ? 0 : null;
  let diasHastaCero: number | null = cashToday < 0 ? 0 : null;
  let pisoSaldo = cashToday;
  let pisoDia = 0;
  let pisoIdx = 0;
  const saldos: number[] = [cashToday];
  const dias: number[] = [0];

  ord.forEach((m, k) => {
    saldo += m.monto;
    const d = daysBetween(hoy, m.fecha);
    if (diasHastaMinimo == null && saldo < ref) diasHastaMinimo = d;
    if (diasHastaCero == null && saldo < 0) diasHastaCero = d;
    if (saldo < pisoSaldo) {
      pisoSaldo = saldo;
      pisoDia = d;
      pisoIdx = k + 1;
    }
    saldos.push(saldo);
    dias.push(d);
  });

  let diasRecuperacion: number | null = null;
  for (let i = pisoIdx + 1; i < saldos.length; i++) {
    if ((saldos[i] as number) >= ref) {
      diasRecuperacion = dias[i] as number;
      break;
    }
  }

  const tocaCero = diasHastaCero != null || cashToday < 0;
  const tocaMinimo = diasHastaMinimo != null || cashToday < ref;
  const estado: EstadoCaja = tocaCero ? "critico" : tocaMinimo ? "ajustado" : "sano";

  return {
    saldoHoy: cashToday,
    diasHastaMinimo,
    diasHastaCero,
    piso: { saldo: pisoSaldo, dia: pisoDia },
    diasRecuperacion,
    horizonteDias: (dias[dias.length - 1] as number) ?? 0,
    estado,
  };
}

/** ¿Hay proyección forward suficiente para mostrar el medidor/cascada? Necesitamos ≥1 movimiento
 *  futuro derivado; si no, no hay nada que proyectar → el caller muestra el estado honesto. */
export function hayProyeccion(movimientos: MovimientoCaja[]): boolean {
  return movimientos.length > 0;
}

/** Causa del punto más bajo: una salida que empuja la caja hacia el piso. */
export interface CausaQuiebre {
  label: string;
  /** Monto FIRMADO (negativo = egreso). */
  monto: number;
  fechaLabel: string;
  tipo?: MovTipo;
}

/** Top N causas del quiebre = los mayores EGRESOS que ocurren hasta el día del piso (inclusive),
 *  rankeados por monto. Responde "¿qué me lleva al punto más bajo?" (visión Parte 1: el punto de
 *  quiebre con sus causas principales). Solo egresos (monto < 0); las cobranzas no hunden la caja.
 *  Usa los movimientos INDIVIDUALES (con label real: "F29", nombre del proveedor), no los semanales.
 *  PURO. */
export function causasDelPiso(
  movimientos: MovimientoCaja[],
  hoy: Date,
  pisoDia: number,
  n = 3,
): CausaQuiebre[] {
  return movimientos
    .filter((m) => m.monto < 0 && daysBetween(hoy, m.fecha) <= pisoDia)
    .sort((a, b) => a.monto - b.monto) // el más negativo primero
    .slice(0, n)
    .map((m) => ({ label: m.label, monto: m.monto, fechaLabel: m.fechaLabel, tipo: m.tipo }));
}

/** Agrupa los movimientos por SEMANA (bucket de 7 días desde hoy) para que la CASCADA sea legible:
 *  con decenas de docs por vencimiento, una barra por doc queda ilegible. Cada semana → un
 *  movimiento con el NETO de la semana y su fecha de inicio. El medidor sigue usando los movimientos
 *  individuales (acumulado exacto); esto es solo para el gráfico. Ordenado por semana. PURO. */
export function movimientosPorSemana(movimientos: MovimientoCaja[], hoy: Date): MovimientoCaja[] {
  const porSemana = new Map<number, { fecha: Date; monto: number }>();
  for (const m of movimientos) {
    const semana = Math.floor(Math.max(0, daysBetween(hoy, m.fecha)) / 7);
    const prev = porSemana.get(semana);
    if (prev) prev.monto += m.monto;
    else porSemana.set(semana, { fecha: addDays(hoy, semana * 7), monto: m.monto });
  }
  return [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, v]) => ({
      fecha: v.fecha,
      // Rango de la semana ("21–27 jul"), no un día suelto: "Esta semana · 21-jul" coincidía con "hoy".
      fechaLabel: rangoSemanaLabel(v.fecha, addDays(v.fecha, 6)),
      label: semana === 0 ? "Esta semana" : `Sem +${semana}`,
      monto: v.monto,
      tipo: v.monto >= 0 ? ("cobranza" as const) : ("otro" as const),
    }));
}
