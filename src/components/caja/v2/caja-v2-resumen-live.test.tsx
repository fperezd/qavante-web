import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UnclassifiedSummary } from "@/lib/api/treasury";
import { FlujoBlock } from "./caja-v2-resumen-live";

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
