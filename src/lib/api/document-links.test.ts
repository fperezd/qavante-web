import { describe, expect, it } from "vitest";
import {
  DOCUMENT_LINKS_LIMIT,
  DOCUMENT_LINKS_PATH,
  indexDocumentLinks,
  resolveDocumentLink,
  type DteDocumentLink,
  type DteDocumentLinksResponse,
} from "./document-links";

/* D07 — el productor publica UNA lectura (`GET /api/sii/document-links`). Estos tests fijan que el
   cliente no invente identidades ni efectos: indexa por el corrector vigente y distingue
   "no hay observación" de "no pudimos consultar". */

function link(over: Partial<DteDocumentLink> = {}): DteDocumentLink {
  return {
    id: "dl-1",
    document_kind: "payable",
    correcting_document_id: "doc-1",
    correcting_source_external_id: "61-1-76111111-1",
    correcting_document_type: 61,
    target_document_id: null,
    target_source_external_id: null,
    target_match_count: 0,
    link_status: "possible_association",
    reference_evidence: {
      source: "sii_rcv",
      reference_index: 1,
      observed_at: "2026-06-02T12:00:00Z",
      digest_sha256: "b".repeat(64),
      validated: false,
      identity_consistent: false,
      observation_kind: "reference",
      cod_ref: 1,
    },
    monetary_effect: {
      kind: "unknown",
      automatic_allowed: false,
      amount: null,
      currency_code: null,
    },
    classification_version: "dte-reference-v2",
    classification_reason: "reference_ambiguous",
    is_current: true,
    ...over,
  };
}

const response = (items: DteDocumentLink[]): DteDocumentLinksResponse => ({
  count: items.length,
  items,
});

describe("document-links — lectura D07", () => {
  it("consume la ruta y el tope que publica el contrato", () => {
    expect(DOCUMENT_LINKS_PATH).toBe("/api/sii/document-links");
    expect(DOCUMENT_LINKS_LIMIT).toBeLessThanOrEqual(1000);
    expect(DOCUMENT_LINKS_LIMIT).toBeGreaterThan(0);
  });

  it("indexa por el identificador del DTE corrector", () => {
    const index = indexDocumentLinks(
      response([link(), link({ id: "dl-2", correcting_source_external_id: "56-2-76111111-1" })]),
    );
    expect([...index.keys()]).toEqual(["61-1-76111111-1", "56-2-76111111-1"]);
    expect(index.get("61-1-76111111-1")?.id).toBe("dl-1");
  });

  it("una observación reemplazada nunca pisa a la vigente", () => {
    const vigente = link({ id: "vigente", is_current: true });
    const historica = link({ id: "historica", is_current: false });
    // El histórico primero: si el índice no filtrara, ganaría él.
    expect(indexDocumentLinks(response([historica, vigente])).get("61-1-76111111-1")?.id).toBe(
      "vigente",
    );
    // Gemelo positivo con el MISMO orden: con las dos vigentes, gana la primera.
    expect(
      indexDocumentLinks(response([link({ id: "primera" }), link({ id: "segunda" })])).get(
        "61-1-76111111-1",
      )?.id,
    ).toBe("primera");
  });

  it("sin items responde un índice vacío, no una inferencia", () => {
    expect(indexDocumentLinks(undefined).size).toBe(0);
    expect(indexDocumentLinks(response([])).size).toBe(0);
  });

  it("resuelve: observada, no observada y no consultable son tres cosas distintas", () => {
    const index = indexDocumentLinks(response([link()]));
    expect(resolveDocumentLink(index, "61-1-76111111-1", {})).toEqual({
      availability: "available",
      link: index.get("61-1-76111111-1"),
    });
    expect(resolveDocumentLink(index, "61-9-76111111-1", {})).toEqual({
      availability: "not_observed",
    });
    expect(resolveDocumentLink(index, "61-1-76111111-1", { failed: true })).toEqual({
      availability: "unavailable",
    });
  });

  it("un documento sin identidad estable no consulta ni concluye nada", () => {
    const index = indexDocumentLinks(response([link()]));
    expect(resolveDocumentLink(index, null, {})).toBeUndefined();
    expect(resolveDocumentLink(index, "", {})).toBeUndefined();
  });

  it("mientras el índice no llegó, la fila no dice 'sin evidencia'", () => {
    expect(resolveDocumentLink(undefined, "61-1-76111111-1", {})).toBeUndefined();
    // Gemelo: con el índice ya resuelto, la MISMA clave ausente sí dice que no hay observación.
    expect(resolveDocumentLink(new Map(), "61-1-76111111-1", {})).toEqual({
      availability: "not_observed",
    });
  });
});
