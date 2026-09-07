import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { GroupedTable } from "./rcv-list-view";

const totals = { neto: 0, exento: 0, iva: 0, total: 0, grossTotal: 0, ncTotal: 0, ncCount: 0 };

describe("vencimientos en Libro de Ventas", () => {
  it("en detalle muestra fecha, supuesto y una ausencia honesta", () => {
    render(
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

    expect(screen.getByText("Vence")).toBeInTheDocument();
    expect(screen.getByText("31-07-2026")).toBeInTheDocument();
    expect(screen.getByText("estimado")).toBeInTheDocument();
    expect(screen.getAllByText("s/d").length).toBeGreaterThan(0);
  });

  it("en agrupado muestra el supuesto y la ausencia en notas de credito", () => {
    render(
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

    expect(screen.getByText("31-07-2026")).toBeInTheDocument();
    expect(screen.getByText("estimado")).toBeInTheDocument();
    expect(screen.getAllByText("s/d").length).toBeGreaterThan(0);
  });
});
