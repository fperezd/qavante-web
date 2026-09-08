import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { rcvDueDate, rcvDueDateIsEstimated } from "./rcv-grouped-item";
import { GroupedTable } from "./rcv-list-view";

const totals = { neto: 0, exento: 0, iva: 0, total: 0, grossTotal: 0, ncTotal: 0, ncCount: 0 };

describe("vencimientos en Libro de Ventas", () => {
  it("la frontera temporal rechaza fechas ausentes o inválidas sin fabricar un default", () => {
    expect(rcvDueDate({ due_date_source: "assumed_30d" })).toBeNull();
    expect(rcvDueDate({ due_date: "2026-99-99", due_date_source: "assumed_30d" })).toBeNull();
    expect(rcvDueDateIsEstimated({ due_date_source: "assumed_30d" })).toBe(false);
  });

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
    expect(html).toContain("No informada");
    expect(html).toContain("Fecha estimada: emisión + 30 días.");
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
        totals={{ ...totals, grossTotal: 100, ncTotal: 100, ncCount: 1 }}
        partyLabel="Cliente"
        hasActiveFilters={false}
        onSelect={() => undefined}
        sort={null}
        onToggleSort={() => undefined}
        showDueDate
        dteKind="ventas"
        dteWindow={{ desde: "2026-07-01", hasta: "2026-07-31" }}
      />,
    );

    expect(html).toContain("31-07-2026");
    expect(html).toContain("estimado");
    expect(html).toContain("No informada");
    expect(html).toMatch(/<tfoot[\s\S]*colspan="5"/i);
    expect(html).toMatch(/<tfoot[\s\S]*colspan="10"/i);
  });
});
