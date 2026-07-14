/* Lógica PURA de la brecha de caja de Pagar v2 (sin React): ¿la caja proyectada cubre
   los pagos críticos del horizonte? Aritmética de lectura sobre datos que ya vienen en
   `accounts-payable` (`projected_cash_14d`, buckets críticos). No inventa nada. */

export interface Brecha {
  /** ¿La caja cubre los pagos críticos? */
  cubre: boolean;
  /** Cuánto falta (0 si cubre). */
  faltante: number;
  /** Cuánto sobra (0 si no cubre). */
  holgura: number;
  /** % de los críticos que la caja cubre (0-100). */
  pctCubierto: number;
}

export function calcularBrecha(cajaProyectada: number, pagosCriticos: number): Brecha {
  const criticos = Math.max(0, pagosCriticos);
  const caja = Math.max(0, cajaProyectada);
  return {
    cubre: caja >= criticos,
    faltante: Math.max(0, criticos - caja),
    holgura: Math.max(0, caja - criticos),
    pctCubierto: criticos > 0 ? Math.min(100, (caja / criticos) * 100) : 100,
  };
}

/** La brecha REAL tras empujar lo postergable: `faltante − postergable` (nunca < 0).
 *  El insight del mockup ("de la brecha $X es postergable → brecha real $Y"). */
export function brechaResidual(faltante: number, postergable: number): number {
  return Math.max(0, faltante - Math.max(0, postergable));
}
