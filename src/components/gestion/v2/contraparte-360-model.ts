/* Modelo PURO del 360 de una contraparte (cliente o proveedor), sin React → testeable. Opera sobre
   los `DocConVencimiento` del maestro (RCV ventas o compras, ~24 meses) y deriva: agregado por
   contraparte, serie mensual continua, tendencia año-contra-año, estacionalidad y concentración.
   Simétrico: la MISMA lógica sirve para el 360 de ventas (clientes) y el de compras (proveedores);
   la vista cambia el lenguaje. Todo del contrato que ya existe; no inventa "días de pago real"
   (eso es el comportamiento_pago = brecha de CC-API, ver STATE_OF_THE_TRAIN). */

import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import { addMonths, comparePeriod } from "@/lib/period/period-range";
import { normalizeRut } from "@/lib/validators/rut";
import { isNotaCredito } from "@/components/sii/tipo-doc";

/** Monto FIRMADO para netear: la NC resta; un doc reclamado no cuenta ($0). Magnitud → signo.
 *  Usa el canónico `isNotaCredito` (códigos 60, 61 y 112) — antes un set local omitía el 60 (NC no
 *  electrónica) e inflaba el 360, contradiciendo al maestro de Pagar/Cobrar que sí la netea. */
export function montoFirmado(d: DocConVencimiento): number {
  if (d.reclamado) return 0;
  const abs = Math.abs(d.monto) || 0;
  return isNotaCredito(d.tipoDoc) ? -abs : abs;
}

/** "DD/MM/YYYY" (RCV) o ISO "YYYY-MM-DD" → "YYYY-MM". `null` si no parsea. */
export function periodoDe(fecha: string): string | null {
  const dmy = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  const iso = fecha.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return null;
}

export interface ContraparteAgregada {
  rut: string;
  name: string;
  /** Neto en la ventana (NC ya restadas). */
  total: number;
  docs: number;
  primerPeriodo: string;
  ultimoPeriodo: string;
}

/** Agrega los docs por contraparte (RUT): total neto, nº de docs y primer/último mes con actividad.
 *  Orden descendente por total (los que más pesan primero). */
export function agregarContrapartes(docs: DocConVencimiento[]): ContraparteAgregada[] {
  const map = new Map<
    string,
    { name: string; total: number; docs: number; min: string; max: string }
  >();
  for (const d of docs) {
    const per = periodoDe(d.fecha);
    if (!d.rut || !per) continue;
    const rut = normalizeRut(d.rut); // mismo RUT con/sin puntos NO se parte en dos filas
    const firm = montoFirmado(d);
    const cur = map.get(rut);
    if (!cur) {
      map.set(rut, { name: d.name || rut, total: firm, docs: 1, min: per, max: per });
    } else {
      cur.total += firm;
      cur.docs += 1;
      if (comparePeriod(per, cur.min) < 0) cur.min = per;
      if (comparePeriod(per, cur.max) > 0) cur.max = per;
      // Backfill del nombre: si el primer doc del RUT vino sin razón social, `name` quedó como el
      // RUT (placeholder) — un doc posterior con nombre real lo reemplaza (antes esta guarda era
      // `!cur.name`, código muerto: `name` nunca es falsy por el `d.name || rut` de arriba).
      if (cur.name === rut && d.name && d.name !== rut) cur.name = d.name;
    }
  }
  return [...map.entries()]
    .map(([rut, v]) => ({
      rut,
      name: v.name,
      total: v.total,
      docs: v.docs,
      primerPeriodo: v.min,
      ultimoPeriodo: v.max,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface PuntoMes {
  periodo: string;
  monto: number;
}

/** Serie mensual CONTINUA (rellena con 0 los meses sin movimiento) del `rut` en [desde, hasta]. */
export function serieMensual(
  docs: DocConVencimiento[],
  rut: string,
  desde: string,
  hasta: string,
): PuntoMes[] {
  const byPer = new Map<string, number>();
  for (const d of docs) {
    if (normalizeRut(d.rut) !== rut) continue; // `rut` viene normalizado del agregado
    const per = periodoDe(d.fecha);
    if (!per) continue;
    byPer.set(per, (byPer.get(per) ?? 0) + montoFirmado(d));
  }
  const out: PuntoMes[] = [];
  let p = desde;
  for (let i = 0; i < 400 && comparePeriod(p, hasta) <= 0; i++) {
    out.push({ periodo: p, monto: byPer.get(p) ?? 0 });
    p = addMonths(p, 1);
  }
  return out;
}

/** Descarta el mes EN CURSO (el último de una serie continua que llega hasta hoy): su valor es
 *  PARCIAL (medio mes) y no se compara con meses completos — distorsiona el año-contra-año, la
 *  estacionalidad y el "a recuperar". Espeja el criterio de `separarMesEnCurso` de la Tendencia. */
export function sinMesEnCurso(serie: PuntoMes[]): PuntoMes[] {
  return serie.length > 0 ? serie.slice(0, -1) : serie;
}

export interface TendenciaAnual {
  ultimos12: number;
  previos12: number;
  /** Variación % de los últimos 12m vs los 12 previos; `null` si no hay base. */
  deltaPct: number | null;
}

/** Año contra año: suma de los últimos 12 meses vs los 12 anteriores. `null` si no hay 24 meses O
 *  si los 12 previos no tienen actividad real (la relación no existía) — sin dos años con actividad
 *  no hay comparación honesta (evita mostrar "vs los 12 previos $0" para un cliente nuevo). */
export function tendenciaAnual(serie: PuntoMes[]): TendenciaAnual | null {
  if (serie.length < 24) return null;
  const n = serie.length;
  const suma = (arr: PuntoMes[]) => arr.reduce((s, p) => s + p.monto, 0);
  const ultimos12 = suma(serie.slice(n - 12));
  const previos12 = suma(serie.slice(n - 24, n - 12));
  if (previos12 <= 0) return null; // sin actividad hace un año → no se compara
  const deltaPct = ((ultimos12 - previos12) / Math.abs(previos12)) * 100;
  return { ultimos12, previos12, deltaPct };
}

export interface MesEstacional {
  /** 1..12 */
  mes: number;
  promedio: number;
}

/** Estacionalidad: promedio de venta/compra por mes de calendario (1..12) sobre los años de la serie.
 *  Responde "¿en qué meses te compra/le compras más?". */
export function estacionalidad(serie: PuntoMes[]): MesEstacional[] {
  const acc = new Map<number, { sum: number; n: number }>();
  for (const p of serie) {
    const mes = Number(p.periodo.slice(5, 7));
    if (!mes) continue;
    const cur = acc.get(mes) ?? { sum: 0, n: 0 };
    cur.sum += p.monto;
    cur.n += 1;
    acc.set(mes, cur);
  }
  const out: MesEstacional[] = [];
  for (let m = 1; m <= 12; m++) {
    const c = acc.get(m);
    out.push({ mes: m, promedio: c && c.n ? c.sum / c.n : 0 });
  }
  return out;
}

/** % que representa esta contraparte del total (concentración). `null` si no hay total. */
export function concentracionPct(total: number, totalGlobal: number): number | null {
  return totalGlobal > 0 ? (total / totalGlobal) * 100 : null;
}
