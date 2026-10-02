import { describe, expect, it } from "vitest";
import {
  DEMO_CASH_FLOW_TRANSACTIONS,
  DEMO_CURRENT_BALANCE,
  DEMO_OVERDUE_RECEIVABLE_TOTAL,
  DEMO_UNDATED_RECEIVABLE,
} from "./cash-flow-data";
import { buildDemoCashProjection } from "./projection-data";

describe("escenario financiero compartido", () => {
  it("calcula el saldo bancario desde los movimientos realizados del flujo de caja", () => {
    const saldo = DEMO_CASH_FLOW_TRANSACTIONS.reduce(
      (total, movement) => total + Number(movement.inflow) - Number(movement.outflow),
      0,
    );

    expect(saldo).toBe(Number(DEMO_CURRENT_BALANCE));
    expect(saldo).toBe(4_768_100);
  });

  it("la suma de saldos de las cuentas simuladas coincide con el saldo consolidado", () => {
    const saldosPorBanco = new Map<string, number>();
    for (const movement of DEMO_CASH_FLOW_TRANSACTIONS) {
      const bankId = movement.bankId ?? "bice";
      const neto = Number(movement.inflow) - Number(movement.outflow);
      saldosPorBanco.set(bankId, (saldosPorBanco.get(bankId) ?? 0) + neto);
    }

    const saldoConsolidado = [...saldosPorBanco.values()].reduce(
      (total, saldo) => total + saldo,
      0,
    );
    expect(saldoConsolidado).toBe(Number(DEMO_CURRENT_BALANCE));
  });

  it("incluye en el mismo historial los pagos y cobros realizados mostrados por sus páginas", () => {
    const ids = new Set(DEMO_CASH_FLOW_TRANSACTIONS.map((movement) => movement.id));

    expect(ids.has("demo-paid-rent-2026-09-24")).toBe(true);
    expect(ids.has("demo-paid-cleaning-2026-07-01")).toBe(true);
    expect(ids.has("demo-collected-support-2026-09-20")).toBe(true);
    expect(ids.has("demo-collected-training-2026-07-09")).toBe(true);
  });

  it("mantiene el total por cobrar igual a los cobros fechados, vencidos y sin fecha", () => {
    const fechados = (
      buildDemoCashProjection(90, 0, new Date("2026-09-23T12:00:00")).demo_movements ?? []
    )
      .filter((movement) => movement.amount > 0)
      .reduce((total, movement) => total + movement.amount, 0);

    expect(fechados + DEMO_OVERDUE_RECEIVABLE_TOTAL + DEMO_UNDATED_RECEIVABLE.amount).toBe(
      5_405_000,
    );
  });
});
