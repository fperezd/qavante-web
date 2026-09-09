import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ api: { post } }));

import {
  DOCUMENT_STATUS_BATCH_SIZE,
  fetchDocumentStatuses,
  rejectReconciliationSuggestion,
} from "./reconciliation";

describe("rejectReconciliationSuggestion", () => {
  beforeEach(() => post.mockReset());

  it("con documento usa el rechazo específico que recuerda el par", async () => {
    post.mockResolvedValueOnce({
      movement_id: "mov/1",
      document_id: "doc/1",
      status: "rejected",
    });

    await expect(
      rejectReconciliationSuggestion({ movementId: "mov/1", documentId: "doc/1" }),
    ).resolves.toMatchObject({ status: "rejected" });
    expect(post).toHaveBeenCalledWith(
      "/api/treasury/reconciliation/mov%2F1/document-suggestions/doc%2F1/reject",
    );
  });

  it("sin documento conserva el rechazo genérico; no inventa un par negativo", async () => {
    post.mockResolvedValueOnce({ movement_id: "mov-1", status: "rejected" });

    await rejectReconciliationSuggestion({ movementId: "mov-1", documentId: null });
    expect(post).toHaveBeenCalledWith("/api/treasury/reconciliation/mov-1/reject");
  });

  it("propaga el error del endpoint específico para que la vista mantenga el movimiento pendiente", async () => {
    const fallo = new Error("documento ya no es elegible");
    post.mockRejectedValueOnce(fallo);

    await expect(
      rejectReconciliationSuggestion({ movementId: "mov-1", documentId: "doc-1" }),
    ).rejects.toBe(fallo);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("fetchDocumentStatuses", () => {
  beforeEach(() => post.mockReset());

  it("consulta todos los documentos en lotes contractuales sin truncar después de 500", async () => {
    post.mockImplementation(async (...args: [string, { body: { documents: unknown[] } }?]) => ({
      items: args[1]?.body.documents ?? [],
    }));
    const documents = Array.from({ length: 1_001 }, (_, index) => ({
      document_kind: "payable",
      source_external_id: `doc-${index}`,
    }));

    const result = await fetchDocumentStatuses(documents);

    expect(result.items).toHaveLength(1_001);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.map((call) => call[1].body.documents.length)).toEqual([
      DOCUMENT_STATUS_BATCH_SIZE,
      DOCUMENT_STATUS_BATCH_SIZE,
      1,
    ]);
  });

  it("deduplica identidades antes de consultar", async () => {
    post.mockResolvedValueOnce({ items: [] });
    const key = { document_kind: "receivable", source_external_id: "33-1-1-9" };

    await fetchDocumentStatuses([key, key]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[1].body.documents).toEqual([key]);
  });
});
