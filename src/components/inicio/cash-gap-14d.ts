/* Caracteriza la brecha de caja a 14 días para el copy del Inicio (banner + card).
 *
 * Razón de existir: el banner NO puede decir "te faltan $X para cubrir tus pagos críticos"
 * cuando el backend reporta obligaciones críticas = $0. En ese caso el "faltante" que sale de
 * `críticas − caja` es en realidad la CAJA EN NEGATIVO, no una brecha contra pagos que no
 * existen. Esta función distingue los casos para que el texto sea honesto.
 *
 * Puro/testeable. `critical` = obligaciones críticas a 14 días; `projected` = caja proyectada
 * a 14 días (ambos ya parseados a número). */

export type CashGap14d =
  /** Hay obligaciones críticas y la caja proyectada no alcanza: brecha real contra pagos. */
  | { kind: "shortfall"; faltante: number }
  /** Sin obligaciones críticas registradas, pero la caja proyectada está bajo cero. */
  | { kind: "overdraft"; projected: number }
  /** El backend declara brecha (`has_gap`) pero no la podemos caracterizar (sin críticas y
   *  caja ≥ 0): ni alarma de pagos ni tranquilidad falsa. */
  | { kind: "declared" };

export function describeCashGap14d(critical: number, projected: number): CashGap14d {
  if (critical > 0) return { kind: "shortfall", faltante: Math.max(0, critical - projected) };
  if (projected < 0) return { kind: "overdraft", projected };
  return { kind: "declared" };
}
