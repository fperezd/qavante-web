/* V16 · Remuneraciones — modelo PURO (issue #77, ESPECIFICACION §V16).
 *
 * Contesta UNA pregunta: "¿cuánto cuesta tu nómina, y a quién le pagaste?"
 *
 * Sin React a propósito, como `pagar-v05-model.ts` / `gestion-v08-model.ts`: cada cifra de esta
 * pantalla (tríada + tabla por persona) se fija en un test sin montar un DOM.
 *
 * ── TRAMPA #1 — doble conteo BUK/Previred (ADR-0056 + ADR-0070) ──────────────────────────────
 * La nómina es un payable REAL en Pagar (ADR-0056) y el MONTO sale de BUK (ADR-0070): el bucket
 * "Previred" de Pagar (`previred-view.tsx`) YA declara que su monto ES `totales.total_cotizaciones`
 * de la MISMA planilla de BUK — no una segunda fuente. `Cotizaciones` de esta tríada reusa la
 * MISMA función (`readPayrollObligaciones`) que ya usan `PlanillaView` y `PreviredView`: un
 * concepto, un número, una fuente (Ley 1) — no se vuelve a sumar en otro lado de la pantalla.
 *
 * `Costo empresa` NO se calcula como `líquido + cotizaciones`. Esa suma duplicaría la porción de
 * cotizaciones que el propio trabajador ya se descontó de su sueldo bruto (esa parte ya está
 * dentro de "Haberes", y por lo tanto ya está reflejada en lo que le cuesta a la empresa antes de
 * llegar al líquido): sumar `cotizaciones` otra vez encima de `líquido` cuenta esa porción DOS
 * VECES. En vez de inventar esa aritmética, se reusa el `costo_empresa` que BUK YA CALCULA por
 * persona (`payroll-detalle.ts`, el mismo campo que muestra la Planilla clásica) y se suma — la
 * MISMA fuente, no una fórmula nueva. Sin detalle por empleado (no-owner, o el conector no lo
 * trae ese mes) no hay costo empresa: se declara "no sé" (`null`), JAMÁS se cae a
 * `líquido + cotizaciones` como aproximación — ese fallback silencioso es exactamente el doble
 * conteo que este módulo existe para evitar (cubierto por
 * `remuneraciones-v16-model.test.ts › costo empresa no duplica cotizaciones`).
 *
 * ── TRAMPA #2 — Ley 9, footer literal ─────────────────────────────────────────────────────────
 * El texto fijo se REUSA de `pagar-v05-model.ts` (`LEY_9_TEXTO`), no se retipea acá: el MISMO
 * string en las dos pantallas, cubierto por el mismo valor de referencia en ambos tests.
 *
 * ── TRAMPA #3 — Ley 2, sin alarmas ────────────────────────────────────────────────────────────
 * El estado de una persona sin débito bancario calzado es "Pendiente" (ámbar), NUNCA rojo: un
 * sueldo que todavía no se paga dentro del mes es progreso administrativo, no una alarma. Esta
 * pantalla no usa NINGÚN rojo — cero tokens `danger-*`, a propósito (issue #77, Ley 2). */

import type { PayrollTotales } from "@/lib/api/buk";
import { vencimientoPrevired } from "@/components/pagar/previred-vencimiento";
import { currentPeriodSantiago, shiftPeriod } from "../../gestion/gestion-format";
import {
  readPayrollObligaciones,
  sumCostoEmpresa,
  tieneCostoEmpresa,
  type EmployeePayroll,
} from "../payroll-detalle";
import { matchPayrollToBank, type BankDebitLike } from "../payroll-conciliacion";

/* ── Período por defecto ───────────────────────────────────────────────────────────────────── */

/** El último mes CERRADO (mismo criterio que el widget "Remuneraciones" de Inicio,
 *  `inicio/v2/remuneraciones-model.ts`): el mes en curso normalmente no tiene planilla todavía,
 *  así que arrancar ahí sería mostrar "sin datos" la mayoría de los días del mes. */
export function periodoDefaultV16(hoy: Date): string {
  return shiftPeriod(currentPeriodSantiago(hoy), -1);
}

/* ── (1) Tríada: Líquido / Cotizaciones / Costo empresa con % de ingresos ⓘ ──────────────────── */

export interface TriadaV16 {
  periodo: string;
  liquido: number;
  empleados: number | null;
  /** `null` = el conector todavía no expone las cotizaciones de este período ("no sé" explícito,
   *  nunca $0). Misma fuente que la tarjeta "Imposiciones (Previred)" de la Planilla clásica. */
  cotizaciones: number | null;
  /** ISO `YYYY-MM-13` del mes siguiente (Previred electrónico). `null` si el período no calza. */
  cotizacionesVencimiento: string | null;
  /** `null` = sin detalle por empleado (no-owner, o el conector no lo trae este mes). Ver TRAMPA
   *  #1 en la cabecera: JAMÁS se sustituye por `líquido + cotizaciones`. */
  costoEmpresa: number | null;
  /** % de `costoEmpresa` sobre `revenue` del MISMO período. `null` sin costo empresa o sin
   *  ingresos (nunca 0% inventado). */
  costoEmpresaPctIngresos: number | null;
}

/** `null` cuando no hay NADA que mostrar del período (ni líquido ni dotación) — distinto de
 *  "todavía cargando": el período fue consultado y no trajo planilla. */
export function triadaV16(
  periodo: string,
  totales: PayrollTotales | undefined,
  detalle: EmployeePayroll[],
  revenue: number | null,
): TriadaV16 | null {
  const liquido = totales?.total_liquido ?? 0;
  const empleados = totales?.empleados_contados ?? null;
  if (liquido <= 0 && (empleados ?? 0) <= 0) return null;

  const obligaciones = readPayrollObligaciones(totales as Record<string, unknown>);
  /* Costo empresa: SIEMPRE la suma del detalle por persona (BUK ya lo calcula, campo
     `costo_empresa`), NUNCA líquido + cotizaciones — ver TRAMPA #1 en la cabecera del módulo. */
  const costoEmpresa = tieneCostoEmpresa(detalle) ? sumCostoEmpresa(detalle) : null;
  const costoEmpresaPctIngresos =
    costoEmpresa != null && revenue != null && revenue !== 0
      ? (costoEmpresa / revenue) * 100
      : null;

  return {
    periodo,
    liquido,
    empleados,
    cotizaciones: obligaciones.previred,
    cotizacionesVencimiento: vencimientoPrevired(periodo),
    costoEmpresa,
    costoEmpresaPctIngresos,
  };
}

/* ── (2) Tabla por persona: estado + link a la liquidación ───────────────────────────────────── */

export type EstadoPersonaV16 = "pagado" | "pendiente" | "sin_verificar";

export const ESTADO_LABEL: Record<EstadoPersonaV16, string> = {
  pagado: "Pagado ✓",
  pendiente: "Pendiente",
  sin_verificar: "No verificado",
};

export interface PersonaV16 {
  key: string;
  nombre: string;
  rut: string | null;
  liquido: number | null;
  estado: EstadoPersonaV16;
  /** Link "a la liquidación" de esta persona. Hueco declarado en el PR: BUK no expone un
   *  documento de liquidación individual (verificado contra `src/lib/api/types.ts` — sin
   *  `settlement_url`/`payslip` en `EmployeeDetailResponse`). Enlaza al MISMO destino que ya usa
   *  Pagar V05 para la fila "Remuneraciones" (`hrefDe` de `pagar-v05-model.ts`): la Planilla del
   *  período en la vista clásica, donde vive el líquido de esta persona. */
  href: string;
}

function keyDeEmpleado(e: Pick<EmployeePayroll, "id" | "rut" | "nombre">): string {
  return e.id || e.rut || e.nombre;
}

/** Las filas de la tabla, líquido descendente por defecto (la persona de mayor sueldo primero —
 *  sin fecha que ordenar, es un roster; la tabla sigue siendo ordenable por columna en la vista).
 *
 *  `movimientos === null` = el banco del período no se consultó/no llegó todavía: el estado es
 *  "sin verificar", NUNCA "pendiente" — decir "pendiente" sin haber mirado el banco sería un
 *  default plausible sobre un dato que no se tiene (bucket "no sé" explícito, Ley 3). */
export function personasV16(
  detalle: EmployeePayroll[],
  movimientos: BankDebitLike[] | null,
  periodo: string,
): PersonaV16[] {
  const href = `/remuneraciones?period=${periodo}`;
  const matchedKeys =
    movimientos === null
      ? null
      : new Set(
          matchPayrollToBank(detalle, movimientos).matched.map((m) => keyDeEmpleado(m.empleado)),
        );

  const filas: PersonaV16[] = detalle.map((e) => ({
    key: keyDeEmpleado(e),
    nombre: e.nombre,
    rut: e.rut,
    liquido: e.liquido,
    estado:
      matchedKeys === null
        ? "sin_verificar"
        : matchedKeys.has(keyDeEmpleado(e))
          ? "pagado"
          : "pendiente",
    href,
  }));

  return filas.sort((a, b) => (b.liquido ?? -1) - (a.liquido ?? -1));
}

export interface ResumenPersonasV16 {
  total: number;
  pagados: number;
  pendientes: number;
  sinVerificar: number;
}

/** Cuenta por estado — alimenta el detalle de la tarjeta "Líquido" y el footer de la tabla. */
export function resumenPersonas(personas: ReadonlyArray<PersonaV16>): ResumenPersonasV16 {
  return {
    total: personas.length,
    pagados: personas.filter((p) => p.estado === "pagado").length,
    pendientes: personas.filter((p) => p.estado === "pendiente").length,
    sinVerificar: personas.filter((p) => p.estado === "sin_verificar").length,
  };
}

/** Personas del detalle protegidas por confidencialidad (owner-only, ver `payroll-detalle.ts ·
 *  estadoCuadre`): el detalle por empleado puede traer MENOS filas que `empleados_contados` del
 *  agregado. La diferencia es esperada (issue #727 de Remuneraciones), no un error — se declara
 *  en vez de mostrar una tabla que "no cuadra" en silencio. */
export function personasProtegidas(triada: Pick<TriadaV16, "empleados">, filas: number): number {
  return typeof triada.empleados === "number" ? Math.max(0, triada.empleados - filas) : 0;
}
