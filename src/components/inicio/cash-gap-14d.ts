/* Caracteriza la brecha de caja a 14 días para el copy del Inicio (banner + card + termómetro).
 *
 * LA BRECHA LA PUBLICA EL BACKEND (D01/D03, #296). `cash_gap_amount_14d` es la brecha canónica
 * contra cero de la curva a 14 días: `max(0, −min_14d)`, con las obligaciones comprometidas YA
 * incluidas en los saldos proyectados. Este módulo la LEE; no la reconstruye.
 *
 * Lo que hacía la versión anterior, y por qué era el defecto: recibía dos números
 * (`critical_obligations_14d`, `projected_cash_14d`) y armaba la brecha como "críticas menos
 * caja" cuando la caja era positiva, o publicaba el saldo final con el signo cambiado cuando
 * era negativa. Con el fixture canónico del repo (`inicio-resumen.fixtures.ts`: brecha
 * 14.000.000, saldo final −10.000.000, mínimo −14.000.000) publicaba 10.000.000. Saldo final ≠
 * mínimo ≠ brecha: el saldo al día 14 no dice nada del valle intermedio, y las obligaciones ya
 * están netas en la curva, así que restarlas otra vez es doble conteo. El guard
 * `no-local-cash-gap` fija que esa resta no vuelva.
 *
 * MISMA FORMA que el publicador vivo (`resumen/inicio-resumen-model.ts` → `resumenCaja`), para no
 * tener una tercera lectura del mismo contrato:
 *   · atención = `has_gap === true` o `min_14d < 0`;
 *   · brecha cuantificada = atención y `cash_gap_amount_14d > 0`;
 *   · lo ausente / ilegible es `null`, nunca cero: una brecha declarada sin monto queda
 *     "declarada", no "$0" ni "cubierta".
 *
 * Puro/testeable. Recibe el summary (o la parte de él que importa) y devuelve el `kind` más las
 * tres cifras del contrato, cada una con su nombre, para que el copy las muestre por separado y
 * NUNCA las combine. */

import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { parseAmountOrNull } from "@/lib/formatters/amount";

/** Lo que este módulo lee del summary: el bloque de brecha y el mínimo del pronóstico. */
export type CashGap14dInput =
  | Pick<DashboardSummaryV2, "cash_gap" | "cash_forecast">
  | null
  | undefined;

/** Las tres cifras del contrato, separadas a propósito (D03). `null` = el backend no la publicó
 *  o no es legible; no se rellena con cero ni con otra de las tres. */
export interface CashGap14dCifras {
  /** `cash_forecast.min_14d`: lo más bajo que llega la caja en la ventana. */
  minimo: number | null;
  /** `cash_gap.projected_cash_14d`: el saldo al cierre del día 14, DESPUÉS de todos los flujos. */
  saldoFinal: number | null;
  /** `cash_gap.critical_obligations_14d`: lo que vence en la ventana. Ya está dentro de la curva. */
  criticas: number | null;
}

export type CashGap14d =
  /** Ni bloque de brecha ni mínimo: no se sabe. No es "cubierto". */
  | { kind: "sin_dato" }
  /** El backend dice explícitamente que NO hay brecha (`has_gap: false`) y ninguna cifra lo
   *  contradice. */
  | { kind: "cubierto" }
  /** Hay brecha y el backend la cuantificó: `faltante` ES `cash_gap_amount_14d`, tal cual. */
  | ({ kind: "brecha"; faltante: number } & CashGap14dCifras)
  /** El backend declara brecha (`has_gap` o mínimo bajo cero) pero no publicó un monto
   *  positivo, o sus cifras se contradicen: ni alarma con un número inventado ni tranquilidad
   *  falsa. */
  | ({ kind: "declared" } & CashGap14dCifras);

export function describeCashGap14d(s: CashGap14dInput): CashGap14d {
  const g = s?.cash_gap;
  const minimo = parseAmountOrNull(s?.cash_forecast?.min_14d);
  if (!g && minimo == null) return { kind: "sin_dato" };

  const faltante = parseAmountOrNull(g?.cash_gap_amount_14d);
  const cifras: CashGap14dCifras = {
    minimo,
    saldoFinal: parseAmountOrNull(g?.projected_cash_14d),
    criticas: parseAmountOrNull(g?.critical_obligations_14d),
  };

  /* Misma regla de atención que `resumenCaja`: `has_gap` del backend manda, y un mínimo bajo cero
     también es brecha aunque el bloque `cash_gap` no haya venido. El saldo final NO participa:
     un cierre positivo no borra un valle intermedio, y uno negativo no es la brecha. */
  const atencion = g?.has_gap === true || (minimo != null && minimo < 0);
  if (atencion) {
    return faltante != null && faltante > 0
      ? { kind: "brecha", faltante, ...cifras }
      : { kind: "declared", ...cifras };
  }
  if (g?.has_gap === false) {
    // Un monto positivo con `has_gap: false` es una contradicción del contrato: no se afirma
    // cobertura sobre ella, pero tampoco se publica el monto como brecha confirmada.
    return faltante != null && faltante > 0
      ? { kind: "declared", ...cifras }
      : { kind: "cubierto" };
  }
  // `has_gap` ausente/null y mínimo no negativo: el backend no respondió la pregunta.
  return { kind: "sin_dato" };
}
