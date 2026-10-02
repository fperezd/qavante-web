import { describe, expect, it } from "vitest";
import { buildDemoCashProjection } from "./projection-data";

const AS_OF = new Date("2026-09-23T12:00:00");
const CURRENT_BALANCE = 4_066_500;

describe("buildDemoCashProjection", () => {
  it.each([
    [7, 4_987_500, 5],
    [14, 3_817_500, 7],
    [30, 3_571_000, 9],
    [90, 4_051_000, 12],
  ])("calcula el escenario de %i días", (days, expectedBalance, expectedEvents) => {
    const projection = buildDemoCashProjection(days, CURRENT_BALANCE, AS_OF);

    expect(Number(projection.saldo_final)).toBe(expectedBalance);
    expect(projection.demo_movements).toHaveLength(expectedEvents);
    expect(projection.serie).toHaveLength(expectedEvents);
  });

  it("excluye los cobros cuando se solicita el escenario sin ingresos", () => {
    const projection = buildDemoCashProjection(90, CURRENT_BALANCE, AS_OF, false);

    expect(Number(projection.saldo_final)).toBe(1_041_000);
    expect(projection.demo_movements?.every((movement) => movement.amount < 0)).toBe(true);
  });

  it("incluye un pago pendiente en la fecha actual, sin descontarlo del saldo inicial", () => {
    const projection = buildDemoCashProjection(7, CURRENT_BALANCE, AS_OF);
    const paymentDueToday = projection.demo_movements?.find(
      (movement) => movement.date === "2026-09-23",
    );

    expect(paymentDueToday).toMatchObject({
      label: "Pago pendiente · servicio de internet",
      amount: -45_000,
      type: "otro",
    });
    expect(Number(projection.saldo_hoy)).toBe(CURRENT_BALANCE);
  });

  it("no inventa una fecha para la factura cuya fecha de cobro no está confirmada", () => {
    const projection = buildDemoCashProjection(90, CURRENT_BALANCE, AS_OF);

    expect(
      projection.demo_movements?.some((movement) => movement.label.includes("fecha por confirmar")),
    ).toBe(false);
  });
});
