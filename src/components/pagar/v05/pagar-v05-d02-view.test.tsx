import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pagos } from "./pagar-v05-fixtures";
import { PagarV05View } from "./pagar-v05-view";

describe("Pagar V05 D02 view", () => {
  it("declara abstención de nómina cuando la frescura no está confirmada", () => {
    const ap = pagos({
      next_payroll: null,
      payroll_coverage: {
        complete: false,
        sources: [
          {
            source: "buk",
            status: "ready",
            last_success_at: null,
            freshness_confirmed: false,
            covered: false,
          },
          {
            source: "previred",
            status: "ready",
            last_success_at: null,
            freshness_confirmed: false,
            covered: false,
          },
        ],
      },
    });
    const html = renderToStaticMarkup(<PagarV05View pagos={ap} hoy={new Date("2026-08-30")} />);
    expect(html).toContain("Próxima nómina: no determinada");
    expect(html).not.toContain("No hay obligaciones vivas de nómina");
  });

  it("rotula la exportación y navegación como página, no como universo", () => {
    const html = renderToStaticMarkup(
      <PagarV05View pagos={pagos()} pagina={2} onAnterior={() => undefined} />,
    );
    expect(html).toContain("Página 2 · exporta sólo esta página");
    expect(html).toContain("Exportar esta página");
    expect(html).toContain("Anterior");
  });

  it("no publica monto negociable derivado de los ítems de la página", () => {
    const html = renderToStaticMarkup(<PagarV05View pagos={pagos()} />);
    expect(html).not.toContain("es negociable");
    expect(html).not.toContain("Ver Hoy");
  });

  it("muestra todos los ítems de la página API sin una segunda paginación", () => {
    const base = pagos();
    const items = Array.from({ length: 30 }, (_, index) => ({
      ...base.items![0]!,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      label: `Proveedor ${index + 1}`,
      counterparty_name: `Proveedor ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <PagarV05View
        pagos={{
          ...base,
          items,
          items_total: items.length,
          filter_metadata: {
            ...base.filter_metadata,
            matched_items_total: items.length,
            unfiltered_items_total: items.length,
          },
        }}
      />,
    );
    expect(html).toContain("Proveedor 30");
    expect(html).not.toContain('aria-label="Página siguiente"');
  });

  it("una moneda excluida no se presenta como un solo pago", () => {
    const base = pagos();
    const html = renderToStaticMarkup(
      <PagarV05View
        pagos={{
          ...base,
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "0",
            complete: false,
            count: 10,
            unknown_due_date_count: 0,
            excluded_by_currency: [{ currency: "USD", amount: "8300" }],
          },
        }}
      />,
    );
    expect(html).toContain("10 pagos en 14 días");
    expect(html).toContain("1 moneda excluida por falta de tipo de cambio");
    expect(html).not.toContain("1 pago crítico");
  });
});
