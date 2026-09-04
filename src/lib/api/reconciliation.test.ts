import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ api: { post } }));

import { rejectReconciliationSuggestion } from "./reconciliation";

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
