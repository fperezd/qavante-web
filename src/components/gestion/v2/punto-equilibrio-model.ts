/* Modelo PURO del Punto de equilibrio v2 (pedido de Fernando 2026-07-30). En vez de asumir qué es
   fijo/variable, toma las LÍNEAS DE COSTO RECURRENTES reales del breakdown por cuenta (últimos
   meses) y proyecta lo que hay que cubrir el PRÓXIMO mes con "último mes cerrado + tendencia".
   El punto de equilibrio = total a cubrir (una empresa de servicios casi no tiene costo variable,
   así que necesita vender ~lo que le cuesta). Ignora el mes en curso para proyectar (usa los
   cerrados). PURO/testeable.

   Robustez (revisión 2026-07-31):
   - Clasifica costo por SECCIÓN (no por signo): excluye ingresos y "sin clasificar" mirando la
     rama del árbol, no si un mes es negativo → una cuenta con un mes positivo (reverso de NC) NO
     se pierde, y un contra-ingreso negativo NO se cuela como costo.
   - Proyecta sobre los meses CON actividad (ignora los ceros de huecos de clasificación) → una
     línea con hueco en el mes reciente no desaparece ni se infla; y una pendiente negativa nunca
     borra un costo que sigue vivo (piso = último mes con actividad). */

import type { OperationalResultBreakdown, BreakdownRow } from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";

export interface LineaRecurrente {
  label: string;
  /** Último mes cerrado (magnitud del costo, +). */
  mesAnterior: number;
  /** Mes en curso (magnitud del costo, +). */
  mesActual: number;
  /** A cubrir el próximo mes (magnitud, +). */
  proyeccion: number;
  /** Aparece en <2 de los meses cerrados con actividad → se asume mensual. */
  soloUnMes: boolean;
}

export interface PuntoEquilibrio {
  lineas: LineaRecurrente[];
  /** Suma de las proyecciones = piso de venta para no perder. */
  totalACubrir: number;
  /** Ingreso del último mes CERRADO (completo) — para comparar el piso sin usar el mes parcial. */
  ingresoMesAnterior: number;
  /** "YYYY-MM" del último mes cerrado y del mes en curso (para rotular). */
  mesAnterior: string;
  mesActual: string;
}

/** ¿La fila es (o cuelga de) la sección de INGRESOS? Los ingresos no son costos a cubrir. */
function esIngreso(row: BreakdownRow): boolean {
  return row.key === "income" || /ingreso/i.test(row.label);
}

/** ¿La fila es "sin clasificar" (ruido que no es un costo real y recurrente)? */
function esSinClasificar(row: BreakdownRow): boolean {
  return /sin\s+clasificar|no\s+clasificad|sin\s+asignar|no\s+asignad/i.test(row.label);
}

/** Proyección de una serie de costos mensuales (magnitudes ≥ 0; 0 = hueco de clasificación). Usa
 *  SOLO los meses con actividad: piso = último con actividad + tendencia; si la tendencia lo lleva
 *  a ≤0, se queda en el piso (un costo recurrente no desaparece). Aparece 1 mes ⇒ se asume mensual. */
function proyectar(costos: number[]): { valor: number; soloUnMes: boolean } {
  const nz = costos.filter((v) => v > 0);
  if (nz.length === 0) return { valor: 0, soloUnMes: false };
  if (nz.length < 2) return { valor: nz[nz.length - 1]!, soloUnMes: true };
  const base = nz[nz.length - 1]!;
  const slope = (nz[nz.length - 1]! - nz[0]!) / (nz.length - 1);
  const proj = base + slope;
  return { valor: proj > 0 ? proj : base, soloUnMes: false };
}

export function computePuntoEquilibrio(bd: OperationalResultBreakdown): PuntoEquilibrio | null {
  const months = bd.months ?? [];
  if (months.length < 2) return null;
  // Mes en curso = proforma (si el backend lo marca) o el último; proyectamos con los CERRADOS.
  const idxProforma = bd.proforma_month ? months.indexOf(bd.proforma_month) : -1;
  const actual = idxProforma >= 0 ? idxProforma : months.length - 1;
  if (actual < 1) return null; // sin al menos 1 mes cerrado no se puede proyectar

  const lineas: LineaRecurrente[] = [];
  let ingresoMesAnterior = 0;

  const alineado = (row: BreakdownRow): number[] | null => {
    const bm = (row.by_month ?? []).map((v) => parseAmount(v));
    return bm.length === months.length ? bm : null;
  };

  const visitar = (rows: BreakdownRow[], excluida: boolean) => {
    for (const r of rows) {
      const ingreso = esIngreso(r);
      // Ingreso del mes cerrado anterior (de la sección de ingresos de nivel superior).
      if (!excluida && ingreso && r.kind === "section") {
        const bm = alineado(r);
        if (bm) ingresoMesAnterior = Math.max(0, bm[actual - 1] ?? 0);
      }
      const excl = excluida || ingreso || esSinClasificar(r);

      if (r.kind === "account") {
        if (!excl) {
          const bm = alineado(r);
          if (bm) {
            const cerrados = bm.slice(0, actual);
            const sumaCerrados = cerrados.reduce((s, v) => s + v, 0);
            if (sumaCerrados < 0) {
              // Costo neto. Cada mes: solo la parte negativa cuenta como costo (un reverso NO suma costo).
              const costos = cerrados.map((v) => Math.max(0, -v));
              const { valor, soloUnMes } = proyectar(costos);
              if (valor > 0) {
                lineas.push({
                  label: r.label,
                  mesAnterior: costos[costos.length - 1] ?? 0,
                  mesActual: Math.max(0, -(bm[actual] ?? 0)),
                  proyeccion: valor,
                  soloUnMes,
                });
              }
            }
          }
        }
        // Las cuentas son hojas → NO recursar (evita doble conteo si trajera hijos).
      } else if (r.children?.length) {
        visitar(r.children, excl);
      }
    }
  };
  visitar(bd.rows ?? [], false);

  lineas.sort((x, y) => y.proyeccion - x.proyeccion);
  return {
    lineas,
    totalACubrir: lineas.reduce((s, l) => s + l.proyeccion, 0),
    ingresoMesAnterior,
    mesAnterior: months[actual - 1] ?? "",
    mesActual: months[actual] ?? "",
  };
}
