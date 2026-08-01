import { describe, it, expect } from "vitest";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";
import { computePuntoEquilibrio } from "./punto-equilibrio-model";

/* Punto de equilibrio CONCRETO (redefinido 2026-07-31): el piso = lo que gastaste el ÚLTIMO MES
   CERRADO (el previo al mes en curso/proforma). Sin proyección ni %. Meses: abr,may,jun,jul con
   jul = proforma (en curso) ⇒ el mes cerrado que se ancla es JUNIO (índice 2). */
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

  it("toma el gasto CONCRETO del último mes cerrado (junio), no una proyección", () => {
    const mod = pe.lineas.find((l) => l.label === "Mano de obra directa")!;
    expect(mod.monto).toBe(10_837_564); // costo de junio tal cual (no proyecta a julio ni tendencia)
  });

  it("el arriendo de junio SÍ aparece (mes cerrado y completo), no en blanco", () => {
    const arr = pe.lineas.find((l) => l.label === "Arriendos")!;
    expect(arr.monto).toBe(884_855);
  });

  it("excluye ingresos pero CUENTA lo sin clasificar ('si se gastó se gastó'); ordena por monto desc", () => {
    // "Compras sin clasificar" ($1M en junio) ahora SÍ suma — antes se excluía y desaparecía.
    expect(pe.lineas.map((l) => l.label)).toEqual([
      "Mano de obra directa",
      "Compras sin clasificar",
      "Arriendos",
    ]);
    expect(pe.totalACubrir).toBe(10_837_564 + 1_000_000 + 884_855);
    expect(pe.mes).toBe("2026-06");
  });

  it("cada línea lleva el código de la cuenta (para el drill-down por documento)", () => {
    expect(pe.lineas.find((l) => l.label === "Mano de obra directa")!.codigo).toBe("mod");
    expect(pe.lineas.find((l) => l.label === "Arriendos")!.codigo).toBe("arr");
  });

  it("expone el ingreso del mismo mes cerrado (para comparar el piso contra lo vendido)", () => {
    expect(pe.ingresoMes).toBe(42_000_000); // ingresos de junio
  });

  it("sin al menos un mes cerrado → null", () => {
    expect(
      computePuntoEquilibrio({ ...BD, months: ["2026-07"], proforma_month: "2026-07" }),
    ).toBeNull();
  });

  it("sin proforma en el rango (mes histórico elegido): ancla en el ÚLTIMO mes, no el anterior", () => {
    // Elegir un mes ya cerrado en el picker ⇒ el backend no marca proforma ⇒ el último del rango
    // (jul) está completo y ES el que se pidió → se ancla en jul, no en jun (bug off-by-one).
    const historico = computePuntoEquilibrio({ ...BD, proforma_month: null })!;
    expect(historico.mes).toBe("2026-07");
    expect(historico.ingresoMes).toBe(42_000_000); // ingresos de julio
    const mod = historico.lineas.find((l) => l.label === "Mano de obra directa")!;
    expect(mod.monto).toBe(8_590_493); // costo de julio (último del rango), no el de junio
  });

  it("ingresoMes: la sección canónica (key 'income') gana sobre otra sección con 'ingreso' en el label", () => {
    // Segunda sección top-level "Ingresos no operacionales" (menor) procesada DESPUÉS de la canónica.
    const conNoOperacional = {
      ...BD,
      rows: [
        ...(BD.rows as OperationalResultBreakdown["rows"]),
        {
          kind: "section",
          key: "non_operating_income",
          label: "Ingresos no operacionales",
          by_month: ["100000", "100000", "100000", "100000"],
          total: "400000",
        },
      ] as OperationalResultBreakdown["rows"],
    };
    const pe = computePuntoEquilibrio(conNoOperacional)!;
    expect(pe.ingresoMes).toBe(42_000_000); // la venta operacional, NO los $100.000 no operacionales
  });
});

/* Robustez: signo del mes cerrado (costo vs reverso) y alineación de series. */
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
  it("si el mes cerrado (junio) tiene un reverso de NC (neto ≥0), la línea no suma piso", () => {
    // jun (índice 2) = +200.000 ⇒ ese mes no fue costo ⇒ no aparece.
    const pe = computePuntoEquilibrio(
      bdCosto("Proveedor", ["-1000000", "-1000000", "200000", "0"]),
    )!;
    expect(pe.lineas).toHaveLength(0);
    expect(pe.totalACubrir).toBe(0);
  });

  it("usa el mes cerrado real aunque el mes en curso sea 0 (no lo confunde con el actual)", () => {
    // jun = -1.500.000 (costo real del mes cerrado); jul (en curso) = 0 y se ignora.
    const pe = computePuntoEquilibrio(
      bdCosto("Arriendo", ["-1000000", "-1000000", "-1500000", "0"]),
    )!;
    expect(pe.lineas[0]!.monto).toBe(1_500_000);
  });

  it("ignora la fila cuya serie no está alineada con los meses (defensivo)", () => {
    const pe = computePuntoEquilibrio(bdCosto("Corta", ["-1000000", "-1000000"]))!;
    expect(pe.lineas).toHaveLength(0);
  });
});
