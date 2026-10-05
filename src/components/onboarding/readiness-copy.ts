/* Copy de la pantalla de readiness financiera. SIN React → testeable.

   ## Por qué el copy se compone acá y no se imprime el `statement` de la API

   La API publica un `statement` canónico, pero con los montos sin formatear (su
   trabajo es cuantizar, no localizar). La regla de la casa es que **toda cifra que
   un humano lee pasa por `src/lib/formatters/*`**, así que la frase se arma de este
   lado desde los campos estructurados. El `statement` del servidor queda como el
   registro de auditoría de lo que la API afirmó.

   ## Las dos reglas que este módulo hace cumplir

   1. **Siempre un número, y siempre qué cubre ese número.** Nunca una pantalla con
      un texto y sin cifra. La API garantiza que `minimum_cash` y
      `essential_outflow_days_covered` vienen con valor; acá se garantiza que se
      muestran.
   2. **Ninguna palabra que traslade al dueño la duda del sistema.** «Preliminar»,
      «estimado», «confianza baja», «no disponible» le dan permiso para no decidir.
      El nivel de confianza existe —viaja en `basis`— pero no se imprime.
      `FORBIDDEN_COPY_WORDS` espeja la lista de la API y el test la recorre sobre
      TODO lo que este módulo emite, en los cinco niveles. */

import { formatClpBare, formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { parseAmount } from "@/lib/formatters/amount";
import {
  READINESS_ACTION_ROUTE,
  type FinancialReadiness,
  type ReadinessLevel,
} from "@/lib/api/onboarding-readiness";

/** Espejo de `financial_readiness.FORBIDDEN_UI_WORDS` en la API. */
export const FORBIDDEN_COPY_WORDS = [
  "preliminar",
  "estimado",
  "estimada",
  "confianza baja",
  "confianza media",
  "confianza alta",
  "no disponible",
  "no hay datos",
  "sin datos",
  "aproximado",
] as const;

/** Monto listo para leer. Sin moneda declarada va SIN símbolo: inventar un "$" sería
 *  inventar la moneda, y un número sin símbolo sigue siendo un número.
 *
 *  La rama `null` es explícita porque `formatMoneyFromDecimalString` cae a CLP cuando
 *  no le dan moneda —devuelve "$1.500.000" para `null`—, que es justamente la puerta
 *  «desconocido → CLP» que la API se cuida de no abrir (`currency: null` cuando la
 *  sociedad no tiene moneda funcional declarada). Delegarle esa decisión habría
 *  deshecho del lado del front lo que el backend declara con cuidado. */
export function readinessAmount(raw: string, currency: string | null): string {
  if (!currency) return formatClpBare(parseAmount(raw));
  return formatMoneyFromDecimalString(raw, currency) ?? formatClpBare(parseAmount(raw));
}

/** Días en palabras, con singular correcto. 0 es un número válido, no un vacío. */
export function readinessDays(days: number): string {
  return days === 1 ? "1 día" : `${days} días`;
}

export interface ReadinessHeadline {
  /** Titular: la acción sobre la cifra ("Mantén $6.000.000 en caja"). */
  title: string;
  /** Qué cubre la cifra. Nunca vacío. */
  covers: string;
  /** La caja de hoy, medida en días de gasto esencial. */
  coverage: string;
}

/** Titular de la pantalla: una acción sobre un número, y qué cubre ese número. */
export function readinessHeadline(fin: FinancialReadiness): ReadinessHeadline {
  const monto = readinessAmount(fin.minimum_cash, fin.currency);
  return {
    title: `Mantén ${monto} en caja`,
    covers: `cubre ${readinessDays(fin.basis.buffer_days)} de tus gastos esenciales`,
    coverage: `Tu caja de hoy cubre ${readinessDays(fin.essential_outflow_days_covered)} de tus gastos esenciales`,
  };
}

export interface ReadinessStep {
  label: string;
  reason: string;
  route: string;
  /** True en el último nivel: la acción ya no es conectar, es decidir. */
  isDecision: boolean;
}

/** El único paso siguiente. Uno, no una lista: un listado de pendientes es un
 *  porcentaje disfrazado y no cambia lo que esta persona hace mañana. */
export function readinessStep(fin: FinancialReadiness): ReadinessStep {
  const level = fin.level as ReadinessLevel;
  return {
    label: fin.next_action.label,
    reason: fin.next_action.reason,
    route: READINESS_ACTION_ROUTE[level] ?? "/inicio",
    isDecision: fin.next_action.code === "ver_plan_de_caja",
  };
}

/** Lo que Qavante ya decide con lo que hay. Siempre una frase, en todos los niveles. */
export function readinessDecision(fin: FinancialReadiness): string {
  return fin.unlocked_decision;
}
