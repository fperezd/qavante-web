import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { rcvDueDate, rcvDueDateIsEstimated, type GroupedItem } from "./rcv-grouped-item";
import { GroupedTable } from "./rcv-list-view";
import type { DteDocumentLink } from "@/lib/api/document-links";

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

/** Observación vigente mínima del contrato D07, indexada por el DTE corrector. */
function d07Link(
  sourceExternalId: string,
  status: DteDocumentLink["link_status"],
  automaticAllowed: boolean,
): DteDocumentLink {
  return {
    id: `dl-${sourceExternalId}`,
    document_kind: "receivable",
    correcting_document_id: `doc-${sourceExternalId}`,
    correcting_source_external_id: sourceExternalId,
    correcting_document_type: 61,
    target_document_id: null,
    target_source_external_id: null,
    target_match_count: automaticAllowed ? 1 : 0,
    link_status: status,
    reference_evidence: {
      source: "sii_rcv",
      reference_index: 1,
      observed_at: "2026-06-02T12:00:00Z",
      digest_sha256: "c".repeat(64),
      validated: automaticAllowed,
      identity_consistent: automaticAllowed,
      observation_kind: "reference",
      cod_ref: 1,
    },
    monetary_effect: {
      kind: status === "annulled_confirmed" ? "full_cancellation" : "unknown",
      automatic_allowed: automaticAllowed,
      amount: null,
      currency_code: null,
    },
    classification_version: "dte-reference-v2",
    classification_reason: "fixture",
    is_current: true,
  };
}

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
        documentLinksIndex={new Map()}
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

  it("en la vista compacta muestra el supuesto y la ausencia en notas de credito", () => {
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
            association: {
              nota: { tipo_doc: 61, folio: 11 },
              status: "unresolved",
              candidateFolios: [],
              reason: "no_candidate",
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
            association: {
              nota: { tipo_doc: 61, folio: 12 },
              status: "unresolved",
              candidateFolios: [],
              reason: "no_candidate",
            },
          },
        ]}
        totals={completeTotals}
        partyLabel="Cliente"
        hasActiveFilters={false}
        sort={null}
        onToggleSort={() => undefined}
        documentLinksIndex={new Map()}
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

  it("usa la decisión D07 sin degradarla a la pista legacy", () => {
    const statuses = [
      ["linked_effect_unknown", "Referencia observada; efecto no confirmado", [100]],
      ["possible_association", "Asociación posible", [101]],
      ["ambiguous", "Evidencia ambigua; requiere revisión", [102, 103]],
      ["unresolved", "Sin asociación fiscal confirmada", []],
    ] as const;
    const items: GroupedItem[] = statuses.map(([status, , candidateFolios], index) => {
      const doc = {
        tipo_doc: 61,
        folio: 20 + index,
        fecha: "2026-07-02",
        rut_contraparte: "76111111-1",
      };
      return {
        t: "nc" as const,
        doc,
        association: {
          nota: doc,
          status: status === "linked_effect_unknown" ? "reference_effect_unknown" : status,
          candidateFolios: [...candidateFolios],
          reason:
            status === "linked_effect_unknown"
              ? ("legacy_reference_without_fiscal_effect" as const)
              : status === "possible_association"
                ? ("unique_rut_amount_match" as const)
                : status === "ambiguous"
                  ? ("multiple_candidates" as const)
                  : ("no_candidate" as const),
        },
      };
    });
    const documentLinks = new Map<string, DteDocumentLink>(
      statuses.map(([status], index) => {
        const sourceExternalId = `61-${20 + index}-76111111-1`;
        return [sourceExternalId, d07Link(sourceExternalId, status, true)];
      }),
    );

    const html = renderToStaticMarkup(
      <GroupedTable
        items={items}
        totals={{ ...totals, ncCount: 4 }}
        partyLabel="Cliente"
        hasActiveFilters={false}
        sort={null}
        onToggleSort={() => undefined}
        documentLinksIndex={documentLinks}
      />,
    );

    for (const [, label] of statuses) expect(html).toContain(label);
    expect(html).not.toContain("Efecto por verificar");
    expect(html).not.toContain("Asociación ambigua");
  });

  it("mantiene factura y NC en dos filas aun cuando D07 confirma el target", () => {
    const sourceExternalId = "61-20-76111111-1";
    const links = new Map<string, DteDocumentLink>([
      [sourceExternalId, d07Link(sourceExternalId, "annulled_confirmed", true)],
    ]);
    const html = renderToStaticMarkup(
      <GroupedTable
        items={[
          {
            t: "fac",
            row: {
              factura: {
                tipo_doc: 33,
                folio: 10,
                rut_contraparte: "76111111-1",
                monto_total: 119000,
                complete: true,
                neto_afecto: 100000,
                exento: 0,
                iva: 19000,
                otros_ajustes_residual: 0,
                total: 119000,
                due_date: "2026-09-30",
                due_date_source: "sii",
              },
              notas: [],
              neto: 119000,
              estado: "vigente",
              matchExacto: true,
              sobreCredito: false,
            },
          },
          {
            t: "nc",
            doc: {
              tipo_doc: 61,
              folio: 20,
              rut_contraparte: "76111111-1",
              monto_total: 119000,
              complete: true,
              neto_afecto: 100000,
              exento: 0,
              iva: 19000,
              otros_ajustes_residual: 0,
              total: 119000,
            },
            association: {
              nota: { tipo_doc: 61, folio: 20 },
              status: "reference_effect_unknown",
              candidateFolios: [10],
              reason: "legacy_reference_without_fiscal_effect",
            },
          },
        ]}
        totals={{ ...totals, total: 0, grossTotal: 119000, ncTotal: 119000, ncCount: 1 }}
        partyLabel="Cliente"
        hasActiveFilters={false}
        sort={null}
        onToggleSort={() => undefined}
        documentLinksIndex={links}
        showDueDate
      />,
    );
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";

    expect(tbody.match(/<tr/g) ?? []).toHaveLength(2);
    expect(tbody).toContain(">10<");
    expect(tbody).toContain(">20<");
    expect(tbody).toContain("Anulación fiscal confirmada");
    expect(tbody).toContain("$119.000");
    expect(tbody).toContain("30-09-2026");
    expect(tbody).not.toContain("line-through");
  });
});
