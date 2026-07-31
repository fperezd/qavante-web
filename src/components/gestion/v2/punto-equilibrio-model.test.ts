import { describe, it, expect } from "vitest";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";
import { computePuntoEquilibrio } from "./punto-equilibrio-model";

const BD: OperationalResultBreakdown = {
  generated_at: "2026-07-31T00:00:00Z",
  period_from: "2026-04",
  period_to: "2026-07",
  mode: "por_cuenta",
  months: ["2026-04", "2026-05", "2026-06", "2026-07"],
  proforma_month: "2026-07",
  rows: [
    {
      kind: "section",
      key: "income",
      label: "Total Ingresos",
      by_month: ["30000000", "25000000", "42000000", "42000000"],
      total: "139000000",
      children: [
        {
          kind: "account",
          key: "ventas",
          label: "Ventas",
          by_month: ["30000000", "25000000", "42000000", "42000000"],
          total: "139000000",
        },
      ],
    },
    {
      kind: "section",
      key: "cost",
      label: "Total Costos",
      by_month: ["-9894574", "-10903553", "-10837564", "-8590493"],
      total: "-40226184",
      children: [
        {
          kind: "account",
          key: "mod",
          label: "Mano de obra directa",
          by_month: ["-9894574", "-10903553", "-10837564", "-8590493"],
          total: "-40226184",
        },
      ],
    },
    {
      kind: "section",
      key: "gasto",
      label: "Total Gastos",
      by_month: ["-1000000", "-1000000", "-1884855", "-1000000"],
      total: "-4884855",
      children: [
        {
          kind: "account",
          key: "arr",
          label: "Arriendos",
          by_month: ["0", "0", "-884855", "0"],
          total: "-884855",
        },
        {
          kind: "account",
          key: "sc",
          label: "Compras sin clasificar",
          by_month: ["-1000000", "-1000000", "-1000000", "-1000000"],
          total: "-4000000",
        },
      ],
    },
  ] as OperationalResultBreakdown["rows"],
};

describe("computePuntoEquilibrio", () => {
  const pe = computePuntoEquilibrio(BD)!;

  it("proyecta las líneas de costo recurrentes con último mes + tendencia", () => {
    const mod = pe.lineas.find((l) => l.label === "Mano de obra directa")!;
    // cerrados (abr,may,jun) = 9.894.574 / 10.903.553 / 10.837.564; base=jun, slope=(jun-abr)/2
    expect(mod.mesAnterior).toBe(10_837_564); // último cerrado (junio)
    expect(mod.mesActual).toBe(8_590_493); // julio (en curso)
    expect(mod.proyeccion).toBe(11_309_059); // 10.837.564 + (10.837.564-9.894.574)/2
    expect(mod.soloUnMes).toBe(false);
  });

  it("una línea que aparece 1 mes (hueco de clasificación) se asume mensual, no se promedia a la baja", () => {
    const arr = pe.lineas.find((l) => l.label === "Arriendos")!;
    expect(arr.proyeccion).toBe(884_855);
    expect(arr.soloUnMes).toBe(true);
    expect(arr.mesActual).toBe(0);
  });

  it("excluye ingresos y lo 'sin clasificar', y ordena por proyección desc", () => {
    expect(pe.lineas.map((l) => l.label)).toEqual(["Mano de obra directa", "Arriendos"]);
    expect(pe.totalACubrir).toBe(11_309_059 + 884_855);
    expect(pe.mesAnterior).toBe("2026-06");
    expect(pe.mesActual).toBe("2026-07");
  });

  it("expone el ingreso del último mes CERRADO (no el parcial en curso)", () => {
    expect(pe.ingresoMesAnterior).toBe(42_000_000); // ingresos de junio (mes cerrado)
  });

  it("sin al menos un mes cerrado → null", () => {
    expect(
      computePuntoEquilibrio({ ...BD, months: ["2026-07"], proforma_month: "2026-07" }),
    ).toBeNull();
  });
});

/* Robustez (revisión 2026-07-31): huecos de clasificación y reversos de NC. */
function bdCosto(label: string, byMonth: string[]): OperationalResultBreakdown {
  return {
    generated_at: "2026-07-31T00:00:00Z",
    period_from: "2026-04",
    period_to: "2026-07",
    mode: "por_cuenta",
    months: ["2026-04", "2026-05", "2026-06", "2026-07"],
    proforma_month: "2026-07",
    rows: [
      {
        kind: "section",
        key: "gasto",
        label: "Total Gastos",
        by_month: byMonth,
        total: "0",
        children: [{ kind: "account", key: "x", label, by_month: byMonth, total: "0" }],
      },
    ] as OperationalResultBreakdown["rows"],
  };
}

describe("computePuntoEquilibrio — robustez", () => {
  it("hueco en el mes reciente: la línea NO desaparece (piso = último mes con actividad)", () => {
    // abr,may,jun cerrados = -1M, -1M, 0 (jul en curso ignorado). Antes se borraba; ahora proyecta 1M.
    const pe = computePuntoEquilibrio(bdCosto("Arriendo", ["-1000000", "-1000000", "0", "0"]))!;
    expect(pe.lineas).toHaveLength(1);
    expect(pe.lineas[0]!.proyeccion).toBe(1_000_000);
  });

  it("reverso de NC (un mes positivo) NO excluye la línea de costo", () => {
    // cerrados = -1M, +200k, -1M → neto negativo ⇒ es costo; el mes positivo cuenta 0 costo.
    const pe = computePuntoEquilibrio(
      bdCosto("Proveedor", ["-1000000", "200000", "-1000000", "0"]),
    )!;
    expect(pe.lineas.map((l) => l.label)).toEqual(["Proveedor"]);
    expect(pe.lineas[0]!.proyeccion).toBe(1_000_000); // nz=[1M,1M] → base 1M, pendiente 0
  });

  it("pendiente negativa fuerte no borra un costo vivo (se queda en el último mes)", () => {
    const pe = computePuntoEquilibrio(
      bdCosto("Decreciente", ["-3000000", "-2000000", "-1000000", "0"]),
    )!;
    expect(pe.lineas[0]!.proyeccion).toBe(1_000_000); // base 1M + slope(-1M) = 0 ⇒ piso 1M
  });
});
