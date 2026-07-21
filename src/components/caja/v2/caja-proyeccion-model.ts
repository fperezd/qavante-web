/* Modelo PURO de la proyección de caja FORWARD (sin React → testeable). La proyección NO sale del
   cash-flow histórico (que no proyecta el futuro) sino de los VENCIMIENTOS DERIVADOS: cobranzas
   esperadas (facturas de venta con su vencimiento derivado, del maestro AR) + obligaciones
   (proveedores/honorarios del maestro AP + F29/Previred/sueldos con su fecha). Cada doc no pagado
   se vuelve un movimiento futuro; el acumulado sobre `cash_today` da el "días de caja" del medidor
   y los pasos de la cascada. Validación real 2026-07-20: el cash-flow de Tooxs es histórico (25
   buckets ene→hoy) sin futuro → la proyección tiene que venir de acá. Ver caja-v3 memory. */

import { daysBetween, type ContraparteMaestro } from "@/components/terminos/terminos-pago";
import { parseAmount } from "@/components/inicio/dashboard-format";
import type { MovimientoCaja, MovTipo } from "./caja-cascada-model";
import type { DiasCaja, EstadoCaja } from "./caja-dias-model";
import type { PayableItem } from "@/lib/api/pagos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de una fecha para el eje: `14-jul`. */
export function fechaCortaLabel(d: Date): string {
  return `${d.getDate()}-${MESES[d.getMonth()] ?? ""}`;
}

/** Fecha efectiva del movimiento: si ya venció (past-due, sigue impago) lo tratamos como "hoy"
 *  (plata esperada ya), si no, su vencimiento. PURO. */
function fechaEfectiva(vencimiento: Date, hoy: Date): Date {
  return daysBetween(hoy, vencimiento) < 0 ? hoy : vencimiento;
}

/** Movimientos forward de un maestro (cobranzas o pagos). Cada doc NO pagado con vencimiento se
 *  vuelve un movimiento en su fecha efectiva. `signo` +1 = cobranza (entra), −1 = pago (sale); las
 *  NC ya vienen con `monto` de signo opuesto en el doc → netean solas. Solo dentro del horizonte. */
export function movimientosDeMaestro(
  cps: ContraparteMaestro[],
  signo: 1 | -1,
  tipo: MovTipo,
  hoy: Date,
  horizonteDias: number,
): MovimientoCaja[] {
  const out: MovimientoCaja[] = [];
  for (const cp of cps) {
    for (const doc of cp.docs) {
      if (doc.pagado || doc.vencimiento == null) continue;
      const efectiva = fechaEfectiva(doc.vencimiento, hoy);
      if (daysBetween(hoy, efectiva) > horizonteDias) continue;
      const monto = signo * doc.monto; // doc.monto ya signado (NC negativo)
      if (monto === 0) continue;
      out.push({
        fecha: efectiva,
        fechaLabel: fechaCortaLabel(efectiva),
        label: cp.name,
        monto,
        tipo,
      });
    }
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
 *  cada item con `due_date` → un pago (outflow) en su fecha efectiva, dentro del horizonte. Se le
 *  pasan SOLO los ítems que no vienen del maestro (categoría ≠ supplier) para no doble-contar. */
export function movimientosDeObligaciones(
  items: PayableItem[],
  hoy: Date,
  horizonteDias: number,
): MovimientoCaja[] {
  const out: MovimientoCaja[] = [];
  for (const it of items) {
    if (!it.due_date) continue;
    const venc = new Date(it.due_date);
    if (Number.isNaN(venc.getTime())) continue;
    const efectiva = fechaEfectiva(venc, hoy);
    if (daysBetween(hoy, efectiva) > horizonteDias) continue;
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
