import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { rcvDueDate, rcvDueDateIsEstimated } from "./rcv-grouped-item";
import { GroupedTable } from "./rcv-list-view";

const totals = {
  neto: null,
  exento: null,
  iva: null,
  total: null,
  grossTotal: null,
  ncTotal: null,
  ncCount: 0,
  breakdown: null,
  incompleteCount: 1,
};
const completeTotals = {
  neto: 100,
  exento: 0,
  iva: 19,
  total: 119,
  grossTotal: 119,
  ncTotal: 19,
  ncCount: 1,
  breakdown: { netoAfecto: 100, exento: 0, iva: 19, otrosAjustes: 0, total: 119, netoSinIva: 100 },
  incompleteCount: 0,
};

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
    expect(html).toContain("Cobertura incompleta");
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
              complete: true,
              neto_afecto: 100,
              exento: 0,
              iva: 19,
              otros_ajustes_residual: 0,
              total: 119,
              due_date: "2026-07-31",
              due_date_source: "assumed_30d",
            },
          },
          {
            t: "nc",
            doc: {
              tipo_doc: 61,
              folio: 12,
              fecha: "2026-07-02",
              complete: true,
              neto_afecto: 0,
              exento: 0,
              iva: 0,
              otros_ajustes_residual: 0,
              total: 0,
            },
          },
        ]}
        totals={completeTotals}
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
    expect(html).toMatch(/<tfoot[\s\S]*colspan="12"/i);
  });
});
