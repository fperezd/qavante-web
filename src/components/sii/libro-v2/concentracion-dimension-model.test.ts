import { describe, expect, it } from "vitest";
import { prepararDistribucion, type DistribucionItem } from "./concentracion-dimension-model";

const item = (label: string, monto: number, pct: number): DistribucionItem => ({
  label,
  monto,
  pct,
});

describe("prepararDistribucion", () => {
  it("ordena desc por monto y toma el top `max`", () => {
    const items = [item("a", 10, 10), item("b", 50, 50), item("c", 30, 30)];
    const { top } = prepararDistribucion(items, 2);
    expect(top.map((i) => i.label)).toEqual(["b", "c"]); // 50, 30
  });

  it("agrupa el resto en 'Otros' (suma monto + pct)", () => {
    const items = [
      item("a", 40, 40),
      item("b", 30, 30),
      item("c", 20, 20),
      item("d", 6, 6),
      item("e", 4, 4),
    ];
    const { top, otros } = prepararDistribucion(items, 3);
    expect(top.map((i) => i.label)).toEqual(["a", "b", "c"]);
    expect(otros).toEqual({ monto: 10, pct: 10 }); // d+e = 6+4 / 6+4
  });

  it("sin resto → otros = null", () => {
    const { otros } = prepararDistribucion([item("a", 10, 100)], 5);
    expect(otros).toBeNull();
  });

  it("'Otros' nunca aporta un pct negativo (clamp a 0)", () => {
    // un rezago con pct negativo (NC que netea raro) no debe dar "Otros −X%".
    const items = [item("a", 100, 120), item("b", -5, -20)];
    const { otros } = prepararDistribucion(items, 1);
    expect(otros?.pct).toBe(0);
  });

  it("no muta el array de entrada", () => {
    const items = [item("a", 10, 10), item("b", 50, 50)];
    const copia = [...items];
    prepararDistribucion(items, 1);
    expect(items).toEqual(copia);
  });
});
