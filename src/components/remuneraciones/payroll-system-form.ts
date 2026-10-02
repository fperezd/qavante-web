/* Modelo del selector de sistema de remuneraciones (CC-API ADR-0122). SIN React →
   testeable.

   Las TRES opciones exactas de la decisión del dueño (2026-10-01): BUK, Talana,
   Manual. "Manual" significa que la empresa no tiene sistema y subirá su nómina por
   archivo. El orden y las etiquetas viven acá, no repartidos por las pantallas.

   Lo que esta capa cuida:

   - **No hay opción "ninguno" ni default.** Que la empresa no haya elegido todavía
     NO es una cuarta opción: es `declared: false` del backend, y se muestra como un
     pendiente, nunca como "BUK" (el defecto que este trabajo cierra).
   - **El cambio rige desde un período**, y los períodos anteriores conservan su
     fuente original. Por eso el formulario pide mes de vigencia, con el mes en curso
     como default. */

/** Las tres opciones exactas; el orden es el de la pantalla. */
import { periodoLargo } from "@/lib/formatters/months";

export const PAYROLL_SYSTEM_IDS = ["buk", "talana", "manual"] as const;

export type PayrollSystemId = (typeof PAYROLL_SYSTEM_IDS)[number];

export interface PayrollSystemOption {
  id: PayrollSystemId;
  label: string;
  /** Qué implica elegirlo, en la voz de la empresa. */
  description: string;
}

export const PAYROLL_SYSTEM_OPTIONS: readonly PayrollSystemOption[] = [
  {
    id: "buk",
    label: "BUK",
    description: "Qavante trae tu planilla desde BUK, con sus liquidaciones y cotizaciones.",
  },
  {
    id: "talana",
    label: "Talana",
    description: "Lo dejamos declarado. La conexión con Talana todavía no está disponible.",
  },
  {
    id: "manual",
    label: "Sin sistema (carga manual)",
    description: "No usas un sistema de remuneraciones: subes tu nómina por archivo.",
  },
] as const;

export function isPayrollSystemId(value: unknown): value is PayrollSystemId {
  return typeof value === "string" && (PAYROLL_SYSTEM_IDS as readonly string[]).includes(value);
}

export function payrollSystemLabel(value: string | null | undefined): string | null {
  if (!isPayrollSystemId(value)) return null;
  return PAYROLL_SYSTEM_OPTIONS.find((o) => o.id === value)?.label ?? null;
}

/** Período de nómina `YYYYMM` del mes que contiene `date`. */
export function periodOf(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}`;
}

/** `YYYYMM` → "septiembre de 2026", para que nadie tenga que leer seis dígitos.
 *
 *  Delega en `periodoLargo` (§5.8): los nombres de mes son UNA fuente en
 *  `lib/formatters/months`, y derivarlos acá con `Intl` haría que el texto dependa del
 *  ICU del runtime del usuario. Lo que no parsea vuelve TAL CUAL: mejor mostrar el
 *  período crudo que un mes inventado. */
export function formatPeriod(period: string): string {
  return periodoLargo(periodToMonthInput(period)) ?? period;
}

/** Valor para un `<input type="month">` (`YYYY-MM`) desde un período `YYYYMM`. */
export function periodToMonthInput(period: string): string {
  if (!/^\d{6}$/.test(period)) return "";
  return `${period.slice(0, 4)}-${period.slice(4)}`;
}

/** `YYYY-MM` del input → período `YYYYMM`; cadena vacía si no es un mes válido. */
export function monthInputToPeriod(value: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  return match ? `${match[1]}${match[2]}` : "";
}

/** Lo que la pantalla necesita saber del estado declarado, ya resuelto. */
export interface PayrollSystemStatus {
  /** La empresa ya eligió. `false` = pendiente; NO significa "eligió BUK". */
  declared: boolean;
  /** Título corto del estado. */
  title: string;
  /** Qué está pasando hoy con los datos de nómina. */
  detail: string;
  /** Tono para la UI: `pending` pide una acción, `info` declara una limitación. */
  tone: "pending" | "ok" | "info";
}

/**
 * Traduce `(payroll_system, adapter_state, effective_from_period)` del contrato a
 * lo que la pantalla muestra. `adapter_state` manda: es el backend el que sabe si
 * el adaptador del sistema elegido existe, y la UI no lo adivina por su cuenta.
 */
export function describeStatus(input: {
  declared: boolean;
  payroll_system?: string | null;
  adapter_state?: string | null;
  effective_from_period?: string | null;
}): PayrollSystemStatus {
  if (!input.declared || !isPayrollSystemId(input.payroll_system)) {
    return {
      declared: false,
      title: "Todavía no elegiste tu sistema de remuneraciones",
      detail:
        "Mientras no lo declares, Qavante sigue intentando traer tu planilla desde BUK. " +
        "Elige el sistema que de verdad usas para que deje de suponerlo.",
      tone: "pending",
    };
  }

  const label = payrollSystemLabel(input.payroll_system) ?? input.payroll_system;
  const since = input.effective_from_period
    ? ` Rige desde ${formatPeriod(input.effective_from_period)}.`
    : "";

  if (input.adapter_state === "manual_upload") {
    return {
      declared: true,
      title: `Tu sistema de remuneraciones: ${label}`,
      detail:
        "Qavante no intenta conectarse a ningún sistema: tu nómina entra por carga de archivo." +
        since,
      tone: "info",
    };
  }

  if (input.adapter_state === "pending_adapter") {
    return {
      declared: true,
      title: `Tu sistema de remuneraciones: ${label}`,
      detail:
        `Quedó declarado. La conexión con ${label} todavía no está disponible, así que ` +
        "Qavante no trae tu planilla automáticamente (y tampoco intenta usar otro sistema)." +
        since,
      tone: "info",
    };
  }

  return {
    declared: true,
    title: `Tu sistema de remuneraciones: ${label}`,
    detail: `Qavante trae tu planilla desde ${label}.` + since,
    tone: "ok",
  };
}

/** Historia fechada, lista para listar: de qué sistema vino cada tramo. */
export function describeEra(era: {
  payroll_system: string;
  effective_from_period: string;
  effective_to_period?: string | null;
}): string {
  const label = payrollSystemLabel(era.payroll_system) ?? era.payroll_system;
  const from = formatPeriod(era.effective_from_period);
  if (!era.effective_to_period) return `${label}: desde ${from} (vigente)`;
  return `${label}: desde ${from} hasta ${formatPeriod(era.effective_to_period)}`;
}

/** Cuerpo del `PUT`, o `null` si el formulario todavía no es enviable. */
export function formToRequest(form: {
  payrollSystem: string;
  monthInput: string;
}): { payroll_system: PayrollSystemId; effective_from_period: string } | null {
  if (!isPayrollSystemId(form.payrollSystem)) return null;
  const period = monthInputToPeriod(form.monthInput);
  if (!period) return null;
  return { payroll_system: form.payrollSystem, effective_from_period: period };
}
