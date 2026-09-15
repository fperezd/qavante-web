import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UnclassifiedSummary } from "@/lib/api/treasury";
import type { SaldoPunto } from "./caja-curva-model";
import { CurvaCard, FlujoBlock } from "./caja-v2-resumen-live";

function calidad(overrides: Partial<UnclassifiedSummary> = {}): UnclassifiedSummary {
  return {
    count: 3,
    isLoading: false,
    isError: false,
    inflowByCurrency: [{ currency: "CLP", inflow: 2_000_000, count: 3 }],
    unknownCurrencyCount: 0,
    unknownInflowCount: 0,
    ...overrides,
  };
}

describe("FlujoBlock · INV-DEC-010", () => {
  it("mantiene el flujo visible cuando hay movimientos pendientes y relega su revisión a auditoría", () => {
    const html = renderToStaticMarkup(
      <FlujoBlock
        flujo={{ entra: 100_000, sale: 75_000, neto: 25_000 }}
        minimo={null}
        sinClasificar={calidad()}
      />,
    );

    expect(html).toContain("Flujo registrado");
    expect(html).toContain("Entra registrado");
    expect(html).toContain("Sale registrado");
    expect(html).toContain('role="note"');
    expect(html).toContain("Calidad del dato");
    expect(html).toContain('href="/bandeja"');
    expect(html).toContain("Ver auditoría de movimientos");
    expect(html).not.toContain("Falta clasificar");
    expect(html).not.toContain("No podemos mostrar tu entra/sale");
    expect(html).not.toContain("Ir a clasificar");
  });

  it("no sustituye el flujo por un placeholder mientras revisa la calidad de los movimientos", () => {
    const html = renderToStaticMarkup(
      <FlujoBlock
        flujo={{ entra: 100_000, sale: 75_000, neto: 25_000 }}
        minimo={null}
        sinClasificar={calidad({ count: 0, isLoading: true, inflowByCurrency: [] })}
      />,
    );

    expect(html).toContain("Flujo registrado");
    expect(html).toContain("Entra registrado");
    expect(html).toContain("Estamos revisando los movimientos disponibles.");
    expect(html).not.toContain("animate-pulse");
  });
});

/* Cobertura del modo evidencia en Caja. El E2E no puede verla hoy porque el
   entorno no enciende `NEXT_PUBLIC_FF_CAJA_V02`, así que el par vive acá: las
   dos ramas se miden con las MISMAS cadenas y una sola de ellas las publica. */
describe("CurvaCard · modo evidencia del Decision Brief", () => {
  const SERIE: SaldoPunto[] = [
    { label: "Semana 1", saldo: 8_000_000 },
    { label: "Semana 2", saldo: 4_000_000 },
    { label: "Semana 3", saldo: 900_000 },
  ];

  function render(suppressRecommendations: boolean) {
    return renderToStaticMarkup(
      <CurvaCard
        serie={SERIE}
        minimo={2_000_000}
        cruceIdx={2}
        suppressRecommendations={suppressRecommendations}
      />,
    );
  }

  it("sin Brief publica el cruce bajo el mínimo y su plan local", () => {
    const html = render(false);

    expect(html).toContain("Saldo proyectado");
    expect(html).toContain("Bajo el mínimo");
    expect(html).toContain("la caja cae bajo tu mínimo");
    expect(html).toContain("Adelanta una cobranza");
    expect(html).toContain("posterga un pago");
  });

  it("con Brief conserva la curva como evidencia y retira el plan local", () => {
    const html = render(true);

    // La evidencia no se pierde: la curva y su encabezado siguen ahí.
    expect(html).toContain("Saldo proyectado");
    expect(html).toContain("Semana 3");
    // Gemelos exactos del caso anterior: ninguna de las cuatro cadenas sobrevive.
    expect(html).not.toContain("Bajo el mínimo");
    expect(html).not.toContain("la caja cae bajo tu mínimo");
    expect(html).not.toContain("Adelanta una cobranza");
    expect(html).not.toContain("posterga un pago");
  });
});
