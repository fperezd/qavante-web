/* Modelo PURO de la proyección de caja FORWARD (sin React → testeable). La proyección NO sale del
   cash-flow histórico (que no proyecta el futuro) sino de los VENCIMIENTOS DERIVADOS: cobranzas
   esperadas (facturas de venta con su vencimiento derivado, del maestro AR) + obligaciones
   (proveedores/honorarios del maestro AP + F29/Previred/sueldos con su fecha). Cada doc no pagado
   se vuelve un movimiento futuro; el acumulado sobre `cash_today` da el "días de caja" del medidor
   y los pasos de la cascada. Validación real 2026-07-20: el cash-flow de Tooxs es histórico (25
   buckets ene→hoy) sin futuro → la proyección tiene que venir de acá. Ver caja-v3 memory. */

import { daysBetween, addDays, type ContraparteMaestro } from "@/components/terminos/terminos-pago";
import { parseAmount } from "@/components/inicio/dashboard-format";
import type { MovimientoCaja, MovTipo } from "./caja-cascada-model";
import type { DiasCaja, EstadoCaja } from "./caja-dias-model";
import type { PayableItem } from "@/lib/api/pagos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de una fecha para el eje: `14-jul`. */
export function fechaCortaLabel(d: Date): string {
  return `${d.getDate()}-${MESES[d.getMonth()] ?? ""}`;
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

/** Movimientos forward de un maestro (cobranzas o pagos). Cada doc NO pagado con vencimiento en la
 *  ventana [hoy − gracia, hoy + horizonte] se vuelve un movimiento. `signo` +1 = cobranza (entra),
 *  −1 = pago (sale); las NC ya vienen con `monto` de signo opuesto en el doc → netean solas.
 *  `graceDias` acota el past-due que se incluye (default 0 = solo futuro; el past-due viejo se
 *  excluye porque ya está en el cash_today). */
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
    for (const doc of cp.docs) {
      if (doc.pagado || doc.vencimiento == null) continue;
      const efectiva = fechaEnVentana(doc.vencimiento, hoy, graceDias, horizonteDias);
      if (efectiva == null) continue;
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
    const venc = new Date(it.due_date);
    if (Number.isNaN(venc.getTime())) continue;
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
      fechaLabel: fechaCortaLabel(v.fecha),
      label: semana === 0 ? "Esta semana" : `Sem +${semana}`,
      monto: v.monto,
      tipo: v.monto >= 0 ? ("cobranza" as const) : ("otro" as const),
    }));
}
