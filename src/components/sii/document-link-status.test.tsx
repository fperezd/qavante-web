import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_LINK_STATUS_LABELS,
  type DocumentLinkResolution,
  type DocumentLinkStatus,
  type DteDocumentLink,
} from "@/lib/api/document-links";
import { DocumentLinkStatusBadge, documentLinkPresentation } from "./document-link-status";

const STATUSES = Object.keys(DOCUMENT_LINK_STATUS_LABELS) as DocumentLinkStatus[];

/** Observación vigente tal como la publica `GET /api/sii/document-links`. */
function link(
  status: DocumentLinkStatus,
  over: {
    automatic_allowed?: boolean;
    observation_kind?: "reference" | "no_references";
  } = {},
): DteDocumentLink {
  return {
    id: "dl-1",
    document_kind: "payable",
    correcting_document_id: "doc-1",
    correcting_source_external_id: "61-1-76111111-1",
    correcting_document_type: 61,
    target_document_id: "doc-0",
    target_source_external_id: "33-9-76111111-1",
    target_match_count: 1,
    link_status: status,
    reference_evidence: {
      source: "sii_rcv",
      reference_index: 1,
      observed_at: "2026-06-02T12:00:00Z",
      digest_sha256: "a".repeat(64),
      validated: true,
      identity_consistent: true,
      observation_kind: over.observation_kind ?? "reference",
      cod_ref: 1,
    },
    monetary_effect: {
      kind: status === "annulled_confirmed" ? "full_cancellation" : "amount_delta",
      automatic_allowed:
        over.automatic_allowed ??
        (status === "annulled_confirmed" || status === "amount_corrected"),
      amount: null,
      currency_code: "CLP",
    },
    classification_version: "dte-reference-v2",
    classification_reason: "reference_exact",
    is_current: true,
  };
}

function available(
  status: DocumentLinkStatus,
  over?: Parameters<typeof link>[1],
): DocumentLinkResolution {
  return { availability: "available", link: link(status, over) };
}

describe("DocumentLinkStatusBadge", () => {
  it.each(STATUSES)("muestra el copy contractual exacto para %s", (status) => {
    const html = renderToStaticMarkup(
      <DocumentLinkStatusBadge resolution={available(status, { automatic_allowed: true })} />,
    );
    expect(html).toContain(DOCUMENT_LINK_STATUS_LABELS[status]);
  });

  it("sólo rotula una anulación en annulled_confirmed con evidencia acreditada", () => {
    for (const status of STATUSES) {
      const label = documentLinkPresentation(available(status, { automatic_allowed: true })).label;
      expect(label.includes("Anulación fiscal confirmada")).toBe(status === "annulled_confirmed");
    }
  });

  it("D07: sin evidencia que acredite el efecto, una anulación degrada a asociación posible", () => {
    const sinAcreditar = documentLinkPresentation(
      available("annulled_confirmed", { automatic_allowed: false }),
    );
    expect(sinAcreditar.label).toBe("Asociación posible");
    expect(sinAcreditar.label).not.toBe("Anulación fiscal confirmada");
    // Gemelo positivo con la MISMA entrada salvo el gate del servidor.
    expect(
      documentLinkPresentation(available("annulled_confirmed", { automatic_allowed: true })).label,
    ).toBe("Anulación fiscal confirmada");
  });

  it("una corrección de monto sin acreditar tampoco se afirma", () => {
    expect(
      documentLinkPresentation(available("amount_corrected", { automatic_allowed: false })).label,
    ).toBe("Asociación posible");
    expect(
      documentLinkPresentation(available("amount_corrected", { automatic_allowed: true })).label,
    ).toBe("Corrección de monto confirmada");
  });

  it("sin referencias observadas se dice que no hay evidencia, no un efecto", () => {
    const sinReferencias = documentLinkPresentation(
      available("annulled_confirmed", {
        observation_kind: "no_references",
        automatic_allowed: true,
      }),
    );
    expect(sinReferencias.label).toBe("Sin evidencia registrada");
    expect(sinReferencias.title).toContain("No se infiere una anulación");
  });

  it("no presenta el efecto acreditado como ya aplicado", () => {
    for (const status of ["annulled_confirmed", "amount_corrected"] as const) {
      const presentation = documentLinkPresentation(available(status, { automatic_allowed: true }));
      expect(presentation.title).toContain("no demuestra que ya haya sido aplicado");
    }
  });

  it("distingue 'no pudimos consultar' de 'no hay observación'", () => {
    const unavailable: DocumentLinkResolution = {
      availability: "unavailable",
      error: new Error("red"),
    };
    expect(documentLinkPresentation(unavailable).label).toBe("Estado no disponible");
    expect(documentLinkPresentation({ availability: "not_observed" }).label).toBe(
      "Sin evidencia registrada",
    );
    expect(documentLinkPresentation(undefined).label).toBe("Estado no disponible");
    expect(documentLinkPresentation(undefined, true).label).toBe("Consultando evidencia fiscal…");
  });
});
