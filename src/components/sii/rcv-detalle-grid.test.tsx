import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { GroupedTable } from "./rcv-list-view";

const totals = {
  neto: 0,
  exento: 0,
  iva: 0,
  total: 0,
  grossTotal: 0,
  ncTotal: 0,
  ncCount: 0,
};

describe("RcvDetalleGrid · vencimiento de ventas", () => {
  it("muestra la fecha publicada, marca el supuesto de 30 dias y deja la ausencia como s/d", () => {
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
  it("marca como estimado el vencimiento supuesto en una nota de credito agrupada", () => {
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

    expect(screen.getByText("Vence")).toBeInTheDocument();
    expect(screen.getByText("31-07-2026")).toBeInTheDocument();
    expect(screen.getByText("estimado")).toBeInTheDocument();
  });
});
