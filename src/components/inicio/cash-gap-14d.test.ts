import { describe, expect, it } from "vitest";
import { describeCashGap14d } from "./cash-gap-14d";

describe("describeCashGap14d", () => {
  it("con obligaciones críticas y caja insuficiente → shortfall (faltante = críticas − caja)", () => {
    expect(describeCashGap14d(5_000_000, 2_000_000)).toEqual({
      kind: "shortfall",
      faltante: 3_000_000,
    });
  });

  /* ESTE TEST FIJABA EL DEFECTO, no lo atrapaba. Afirmaba
   *
   *     describeCashGap14d(5_000_000, -1_000_000) → { kind: "shortfall", faltante: 6_000_000 }
   *
   * con el comentario "5M de críticas con caja en −1M ⇒ se necesitan 6M". Los 6M **no** hacen
   * falta: `projected_cash_14d` se arma acumulando el neto diario, que YA trae esos 5M de
   * egresos restados, así que el −1M es el saldo que queda DESPUÉS de pagarlos. La plata que
   * hay que conseguir para no terminar en rojo al día 14 es **1M**.
   *
   * Y el `kind` era `shortfall`, cuyo copy dice *"Te faltan $6.000.000 para cubrir tus pagos
   * críticos"* — un monto que **excede** a las obligaciones, publicado con el apellido de
   * ellas. Es el mismo defecto que el #153 corrigió en el backend, del lado del front. */
  it("con obligaciones críticas y caja negativa → el caso MIXTO, y el monto es el descubierto", () => {
    expect(describeCashGap14d(5_000_000, -1_000_000)).toEqual({
      kind: "overdraft_with_dues",
      descubierto: 1_000_000,
      criticas: 5_000_000,
    });
  });

  it("con críticas pero caja que SÍ las cubre (faltante 0) → declared, NO 'shortfall $0'", () => {
    // has_gap=true del backend pero nuestra resta ve cobertura → no afirmar "te faltan $0".
    expect(describeCashGap14d(5_000_000, 6_000_000)).toEqual({ kind: "declared" });
    expect(describeCashGap14d(5_000_000, 5_000_000)).toEqual({ kind: "declared" });
  });

  it("SIN obligaciones críticas ($0) y caja negativa → overdraft, NO 'faltante para pagos críticos'", () => {
    // El caso real de Tooxs: críticas=0, caja=−3.935.682. No es brecha contra pagos: es caja negativa.
    expect(describeCashGap14d(0, -3_935_682)).toEqual({ kind: "overdraft", projected: -3_935_682 });
  });

  it("sin críticas y caja ≥ 0 → declared (el backend dice brecha pero no la caracterizamos)", () => {
    expect(describeCashGap14d(0, 1_000_000)).toEqual({ kind: "declared" });
    expect(describeCashGap14d(0, 0)).toEqual({ kind: "declared" });
  });
});

/* ── El CASO MIXTO: caja bajo cero Y obligaciones reales ──────────────────────────────────
 *
 * La versión anterior ramificaba por `critical > 0` PRIMERO, así que este caso caía en
 * `shortfall` con `faltante = criticas + |proyectada|` — un número que excede a las
 * obligaciones y que el banner publicaba con el apellido de ellas.
 *
 * El backend hace esta distinción desde el #153. Sin estos tests, la misma pantalla se
 * contradice: el banner diría "faltan $3M para pagos críticos" y la frase ejecutiva
 * "queda $1M bajo cero, ya contando los $2M". */
describe("describeCashGap14d — la caja bajo cero manda, tenga o no obligaciones", () => {
  it("con obligaciones reales devuelve el caso mixto, no un shortfall inflado", () => {
    expect(describeCashGap14d(2_000_000, -1_000_000)).toEqual({
      kind: "overdraft_with_dues",
      descubierto: 1_000_000,
      criticas: 2_000_000,
    });
  });

  it("el descubierto NO es la suma: los dos montos no son disjuntos", () => {
    /* `projected_cash_14d` se arma acumulando el neto diario, que YA trae esos egresos
     * restados. El saldo bajo cero es el que queda DESPUÉS de pagarlas, así que la plata que
     * hay que conseguir es el descubierto, no `criticas + |proyectada|`. */
    const g = describeCashGap14d(2_000_000, -1_000_000);
    expect(g.kind).toBe("overdraft_with_dues");
    if (g.kind !== "overdraft_with_dues") return;
    expect(g.descubierto).toBe(1_000_000);
    expect(g.descubierto).not.toBe(3_000_000); // el número que publicaba la versión anterior
  });

  it("UN PESO de obligaciones ya no arrastra $5M al apellido equivocado", () => {
    /* El caso que motivó el cambio: `criticas − proyectada` = 5.000.001, y el banner decía
     * "Te faltan $5.000.001 para cubrir tus pagos críticos" con UN PESO de pagos críticos. */
    expect(describeCashGap14d(1, -5_000_000)).toEqual({
      kind: "overdraft_with_dues",
      descubierto: 5_000_000,
      criticas: 1,
    });
  });

  it("CONTRAPESO · sin obligaciones sigue siendo overdraft, no el caso mixto", () => {
    /* Sin este, el kind nuevo se satisface devolviéndolo siempre que la caja sea negativa, y
     * el copy diría "ya contando los $0 que vencen". */
    expect(describeCashGap14d(0, -3_935_682)).toEqual({
      kind: "overdraft",
      projected: -3_935_682,
    });
  });

  it("CONTRAPESO · con la caja POSITIVA y obligaciones sigue siendo shortfall", () => {
    /* La rama `shortfall` es la que de verdad describe "te faltan $X para tus pagos": es
     * correcta cuando la caja NO está bajo cero, y este cambio no puede matarla. */
    expect(describeCashGap14d(5_000_000, 2_000_000)).toEqual({
      kind: "shortfall",
      faltante: 3_000_000,
    });
  });

  it("CONTRAPESO · la caja exactamente en cero no es 'bajo cero'", () => {
    /* El predicado es `projected < 0`, estricto. Un cero es un valor REAL, no un rojo. */
    expect(describeCashGap14d(5_000_000, 0)).toEqual({ kind: "shortfall", faltante: 5_000_000 });
  });
});
