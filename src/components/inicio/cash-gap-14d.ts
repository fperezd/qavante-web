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
  /** Caja proyectada bajo cero **y** obligaciones críticas reales. NO es la suma de las dos:
   *  `descubierto` es lo que falta para no terminar en rojo, y `criticas` ya está contado
   *  dentro de él. Ver la nota de doble conteo en `describeCashGap14d`. */
  | { kind: "overdraft_with_dues"; descubierto: number; criticas: number }
  /** El backend declara brecha (`has_gap`) pero no la podemos caracterizar (sin críticas y
   *  caja ≥ 0): ni alarma de pagos ni tranquilidad falsa. */
  | { kind: "declared" };

export function describeCashGap14d(critical: number, projected: number): CashGap14d {
  /* LA CAJA BAJO CERO MANDA, tenga o no obligaciones — y este orden es medido, no estético.
   *
   * `criticas − proyectada` con la caja NEGATIVA vale `criticas + |proyectada|`, o sea que
   * **excede a las obligaciones**. Con `criticas = $1` y `proyectada = −$5.000.000` el banner
   * decía *"Te faltan $5.000.001 para cubrir tus pagos críticos"* — con **un peso** de pagos
   * críticos. La versión anterior ramificaba por `critical > 0` primero, así que ese caso caía
   * en `shortfall` y el número se publicaba con el apellido de otra cosa.
   *
   * Y LOS DOS MONTOS NO SE SUMAN. La API arma `projected_cash_14d` acumulando el neto diario,
   * que **ya trae esos egresos restados**, mientras `critical_obligations_14d` es la suma de
   * las magnitudes de **los mismos** egresos. El saldo bajo cero es el que queda DESPUÉS de
   * pagarlas: con `criticas = $2M` y `proyectada = −$1M`, la plata que hay que conseguir para
   * no terminar en rojo al día 14 es **$1M, no $3M**.
   *
   * Por eso el caso mixto es su propio `kind` y no un `shortfall` con otro monto: el copy
   * tiene que nombrar las dos cifras SIN invitar a sumarlas.
   *
   * El backend hace exactamente esta distinción desde el #153 (`dashboard_phrase`,
   * `dashboard_priority_actions` y la tool MCP). Sin este cambio, la MISMA pantalla se
   * contradice: el banner diría "faltan $3M para pagos críticos" y la frase ejecutiva "queda
   * $1M bajo cero, ya contando los $2M". */
  if (projected < 0) {
    if (critical > 0)
      return { kind: "overdraft_with_dues", descubierto: -projected, criticas: critical };
    return { kind: "overdraft", projected };
  }
  if (critical > 0) {
    const faltante = Math.max(0, critical - projected);
    // Hay críticas pero la caja SÍ las cubre (faltante 0): el backend declaró brecha igual
    // (valle intra-período / caja mínima que nosotros no vemos). NO decimos "te faltan $0".
    if (faltante > 0) return { kind: "shortfall", faltante };
    return { kind: "declared" };
  }
  return { kind: "declared" };
}
