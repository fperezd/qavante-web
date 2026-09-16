import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { GroupedTable } from "./rcv-list-view";
import type { GroupedItem } from "./rcv-grouped-item";
import {
  DOCUMENT_LINK_NOT_OBSERVED_LABEL,
  DOCUMENT_LINK_UNAVAILABLE_LABEL,
} from "@/lib/api/document-links";

/* D07 al tope del contrato (#302 P2-2): cuando la lectura de `document-links` llega a `limit`,
   un corrector ausente del índice NO puede decir "Sin evidencia registrada" (afirmación): dice
   "Estado no disponible" (no sé). Cada negativo tiene su gemelo con la misma fila y el índice
   igual de vacío, cambiando sólo la señal de corte. */

const totals = {
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

const NOTA_SIN_OBSERVACION = {
  tipo_doc: 61,
  folio: 20,
  fecha: "2026-07-02",
  rut_contraparte: "76111111-1",
};

const items: GroupedItem[] = [
  {
    t: "nc",
    doc: NOTA_SIN_OBSERVACION,
    association: {
      nota: NOTA_SIN_OBSERVACION,
      status: "unresolved",
      candidateFolios: [],
      reason: "no_candidate",
    },
  },
];

describe("RcvDetalleGrid — corte D07", () => {
  const html = (truncated: boolean) =>
    renderToStaticMarkup(
      <RcvDetalleGrid
        docs={[NOTA_SIN_OBSERVACION]}
        totals={totals}
        partyLabel="Cliente"
        hasActiveFilters={false}
        documentLinksIndex={new Map()}
        documentLinksTruncated={truncated}
      />,
    );

  it("con la respuesta al tope, el corrector ausente queda 'no disponible'", () => {
    const h = html(true);
    expect(h).toContain(DOCUMENT_LINK_UNAVAILABLE_LABEL);
    expect(h).not.toContain(DOCUMENT_LINK_NOT_OBSERVED_LABEL);
  });

  it("gemelo: con la respuesta completa, el MISMO corrector sí es 'sin evidencia'", () => {
    const h = html(false);
    expect(h).toContain(DOCUMENT_LINK_NOT_OBSERVED_LABEL);
    expect(h).not.toContain(DOCUMENT_LINK_UNAVAILABLE_LABEL);
  });
});

describe("GroupedTable — corte D07", () => {
  const html = (truncated: boolean) =>
    renderToStaticMarkup(
      <GroupedTable
        items={items}
        totals={totals}
        partyLabel="Cliente"
        hasActiveFilters={false}
        sort={null}
        onToggleSort={() => undefined}
        documentLinksIndex={new Map()}
        documentLinksTruncated={truncated}
      />,
    );

  it("con la respuesta al tope, el corrector ausente queda 'no disponible'", () => {
    const h = html(true);
    expect(h).toContain(DOCUMENT_LINK_UNAVAILABLE_LABEL);
    expect(h).not.toContain(DOCUMENT_LINK_NOT_OBSERVED_LABEL);
  });

  it("gemelo: con la respuesta completa, el MISMO corrector sí es 'sin evidencia'", () => {
    const h = html(false);
    expect(h).toContain(DOCUMENT_LINK_NOT_OBSERVED_LABEL);
    expect(h).not.toContain(DOCUMENT_LINK_UNAVAILABLE_LABEL);
  });
});
