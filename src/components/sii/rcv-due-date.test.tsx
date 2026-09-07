import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { GroupedTable } from "./rcv-list-view";

const totals = { neto: 0, exento: 0, iva: 0, total: 0, grossTotal: 0, ncTotal: 0, ncCount: 0 };

describe("vencimientos en Libro de Ventas", () => {
  it("en detalle muestra fecha, supuesto y una ausencia honesta", () => {
    const html = renderToStaticMarkup(
      <RcvDetalleGrid
        docs={[
          {
            tipo_doc: 33,
            folio: 9,
            fecha: "2026-07-01",
            due_date: "2026-07-31",
            due_date_source: "assumed_30d",
          },
          { tipo_doc: 33, folio: 10, fecha: "2026-07-02" },
        ]}
        totals={totals}
        partyLabel="Cliente"
        hasActiveFilters={false}
        showDueDate
      />,
    );

    expect(html).toContain("Vence");
    expect(html).toContain("31-07-2026");
    expect(html).toContain("estimado");
    expect(html).toContain("s/d");
  });

  it("en agrupado muestra el supuesto y la ausencia en notas de credito", () => {
    const html = renderToStaticMarkup(
      <GroupedTable
        items={[
          {
            t: "nc",
            doc: {
              tipo_doc: 61,
              folio: 11,
              fecha: "2026-07-01",
              due_date: "2026-07-31",
              due_date_source: "assumed_30d",
            },
          },
          { t: "nc", doc: { tipo_doc: 61, folio: 12, fecha: "2026-07-02" } },
        ]}
        totals={totals}
        partyLabel="Cliente"
        hasActiveFilters={false}
        onSelect={() => undefined}
        sort={null}
        onToggleSort={() => undefined}
        showDueDate
      />,
    );

    expect(html).toContain("31-07-2026");
    expect(html).toContain("estimado");
    expect(html).toContain("s/d");
  });
});
