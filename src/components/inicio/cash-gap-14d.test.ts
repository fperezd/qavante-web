import { describe, expect, it } from "vitest";
import { describeCashGap14d } from "./cash-gap-14d";

describe("describeCashGap14d", () => {
  it("con obligaciones críticas y caja insuficiente → shortfall (faltante = críticas − caja)", () => {
    expect(describeCashGap14d(5_000_000, 2_000_000)).toEqual({ kind: "shortfall", faltante: 3_000_000 });
  });

  it("con obligaciones críticas y caja negativa → shortfall que incluye salir del negativo", () => {
    // 5M de críticas con caja en −1M ⇒ se necesitan 6M.
    expect(describeCashGap14d(5_000_000, -1_000_000)).toEqual({ kind: "shortfall", faltante: 6_000_000 });
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
