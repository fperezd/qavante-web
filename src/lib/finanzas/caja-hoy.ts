/* LEY 1 — "un concepto, un número": el saldo "Caja hoy".
 *
 * Existe por un antecedente medido, no por gusto: `qavante-api#102` dejó el Pulso mostrando 16
 * en Inicio y 32 en su pantalla propia porque cada vista resolvía sus inputs por su cuenta. La
 * spec del rediseño (§V02, aceptación) pide explícitamente que el saldo "Hoy" sea EXACTAMENTE
 * el mismo valor y la misma fuente en V01 (`/`), V02 (`/caja`) y V03 (`/banco`).
 *
 * Este módulo es esa fuente única del lado del front: una sola lectura del bloque `cash_today`
 * de `GET /api/dashboard/summary`, con su frescura. Quien muestre "Caja hoy" llama acá.
 *
 * PURO (sin React, sin hooks) → se testea sin montar un DOM, que es lo que permite que la
 * afirmación "V01 y V02 dicen el mismo número" sea un test y no una promesa del cuerpo del PR.
 *
 * ALCANCE HONESTO: `/banco` (V03) hoy NO consume este selector. Esa pantalla lista los PRODUCTOS
 * del tenant (`/api/bice/saldo`, `/api/bice/tarjetas`) — saldo POR CUENTA y cupo por tarjeta, que
 * es otro concepto y otra fuente. Unificarlo es trabajo de V03 y de la "unificación de
 * definiciones de cifras" que la §Fase 2 pone del lado del backend; declararlo unificado acá
 * sería exactamente la afirmación sin medir que la Ley 1 persigue. */

import { parseAmountOrNull } from "@/lib/formatters/amount";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";

/** Frescura declarada por el backend para el saldo. `null` cuando no vino el bloque. */
export type EstadoCajaHoy = "available" | "stale" | "estimated" | null;

export interface CajaHoy {
  /** El saldo en CLP. `null` = NO SE SABE (el bloque `cash_today` no vino: banco sin conectar,
   *  fuente caída, 500 del dashboard). Nunca `0`: faltante ≠ cero. */
  monto: number | null;
  /** ISO de la última sincronización del banco. `null` si no vino. */
  actualizado: string | null;
  /** Frescura declarada. `null` si no vino el bloque. */
  estado: EstadoCajaHoy;
}

const SIN_DATO: CajaHoy = { monto: null, actualizado: null, estado: null };

/** Saldo "Caja hoy" + su frescura, desde el summary del dashboard.
 *
 *  Acepta el summary completo (o `null`/`undefined` mientras carga o si falló) para que los
 *  llamadores no tengan que desarmar el bloque a mano — desarmarlo a mano en cada pantalla es
 *  justamente cómo se separan los números. */
export function cajaHoy(
  summary: Pick<DashboardSummaryResponse, "cash_today"> | null | undefined,
): CajaHoy {
  const bloque = summary?.cash_today;
  if (!bloque) return SIN_DATO;
  return {
    /* `parseAmountOrNull` y no `parseAmount`: un `total` vacío o no numérico es transporte roto,
       y aplastarlo a `0` publicaría "$0 en caja" sobre un dato que no tenemos. */
    monto: parseAmountOrNull(bloque.total),
    actualizado: bloque.last_updated ?? null,
    estado: bloque.data_state ?? null,
  };
}

/** Atajo: sólo el número. `null` = no se sabe. */
export function saldoCajaHoy(
  summary: Pick<DashboardSummaryResponse, "cash_today"> | null | undefined,
): number | null {
  return cajaHoy(summary).monto;
}
