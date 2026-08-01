/* Modelo PURO del Punto de equilibrio v2 (pedido de Fernando 2026-07-30, redefinido 2026-07-31).

   Fernando: "nada de % ni proyecciones — un dato concreto. El mes pasado gastaste X; si gastas lo
   mismo, necesitas vender X para no perder." Así que el piso = lo que GASTASTE el ÚLTIMO MES CERRADO
   (completo), sumando tus costos recurrentes reales. No se usa el mes en curso (incompleto), no se
   proyecta con tendencia y no se divide por ningún margen: es empírico y honesto.

   - Anclado al último mes CERRADO (el previo al mes en curso/proforma) → nunca muestra un mes a medio
     clasificar (esto arregla el "arriendo de julio en blanco": mostramos junio, que está completo).
   - Clasifica costo por SECCIÓN (no por signo): excluye SOLO los ingresos. Lo "sin clasificar" SÍ se
     cuenta ("si se gastó, se gastó" — Fernando): es plata que salió, aunque falte categorizarla.
     Una cuenta cuyo neto del mes es negativo es un costo (su magnitud); si el neto es ≥0 (mes sin
     costo o reverso de NC) no suma piso.
   - Las cuentas son hojas → no se recursa (evita doble conteo). PURO/testeable. */

import type { OperationalResultBreakdown, BreakdownRow } from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";

export interface LineaRecurrente {
  label: string;
  /** Código de la cuenta de gestión (para el drill-down por documento). */
  codigo: string;
  /** Lo que gastaste en ese costo el último mes cerrado (magnitud, +). */
  monto: number;
}

export interface PuntoEquilibrio {
  lineas: LineaRecurrente[];
  /** Suma de los costos del último mes cerrado = piso concreto de venta ("gastaste esto"). */
  totalACubrir: number;
  /** Ingreso del último mes cerrado (para comparar el piso contra lo que vendiste ese mes). */
  ingresoMes: number;
  /** "YYYY-MM" del último mes cerrado (el completo que anclamos). */
  mes: string;
}

/** ¿La fila es (o cuelga de) la sección de INGRESOS? Los ingresos no son costos a cubrir. */
function esIngreso(row: BreakdownRow): boolean {
  return row.key === "income" || /ingreso/i.test(row.label);
}

export function computePuntoEquilibrio(bd: OperationalResultBreakdown): PuntoEquilibrio | null {
  const months = bd.months ?? [];
  if (months.length < 2) return null;
  // Anclamos en el último mes CERRADO. Si el último del rango es el proforma (mes en curso), es el
  // anterior; si NO hay proforma en el rango (elegiste un mes ya cerrado en el picker), es el último
  // mismo — antes se anclaba siempre en el penúltimo y mostraba el mes previo al seleccionado.
  const idxProforma = bd.proforma_month ? months.indexOf(bd.proforma_month) : -1;
  const ultimo = months.length - 1;
  const cerrado = idxProforma >= 0 ? idxProforma - 1 : ultimo;
  if (cerrado < 0) return null; // sin al menos un mes cerrado no hay dato concreto

  const lineas: LineaRecurrente[] = [];
  let ingresoMes = 0;

  /** Valor del mes cerrado para una fila, solo si su serie está alineada con `months`. */
  const valorCerrado = (row: BreakdownRow): number | null => {
    const bm = (row.by_month ?? []).map((v) => parseAmount(v));
    return bm.length === months.length ? (bm[cerrado] ?? 0) : null;
  };

  const visitar = (rows: BreakdownRow[], excluida: boolean) => {
    for (const r of rows) {
      const ingreso = esIngreso(r);
      // Ingreso del mes cerrado. La sección canónica (key "income", la venta operacional) gana
      // siempre; otra sección con "ingreso" en el label (ej. no operacionales) solo es fallback si
      // aún no tenemos la operacional → así el hero no compara contra un ingreso no operacional menor.
      if (!excluida && ingreso && r.kind === "section") {
        const v = valorCerrado(r);
        if (v != null && (r.key === "income" || ingresoMes === 0)) ingresoMes = Math.max(0, v);
      }
      // "Si se gastó, se gastó" (Fernando 2026-08-01): lo SIN CLASIFICAR se CUENTA igual (no se
      // excluye) — clasificar decide la CATEGORÍA, no si el gasto cuenta. Aparece como su propia
      // línea ("Compras sin clasificar") y el drill-down muestra qué hay dentro (ej. el arriendo).
      const excl = excluida || ingreso;

      if (r.kind === "account") {
        if (!excl) {
          const v = valorCerrado(r);
          // Neto negativo del mes ⇒ costo (su magnitud). Neto ≥0 (mes sin costo o reverso) ⇒ no suma.
          if (v != null && v < 0) lineas.push({ label: r.label, codigo: r.key ?? "", monto: -v });
        }
        // Las cuentas son hojas → NO recursar (evita doble conteo si trajera hijos).
      } else if (r.children?.length) {
        visitar(r.children, excl);
      }
    }
  };
  visitar(bd.rows ?? [], false);

  lineas.sort((x, y) => y.monto - x.monto);
  return {
    lineas,
    totalACubrir: lineas.reduce((s, l) => s + l.monto, 0),
    ingresoMes,
    mes: months[cerrado] ?? "",
  };
}
