import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const received = vi.hoisted(() => ({ kind: "", id: "", autoOpen: false }));

vi.mock("@/components/documents/document-actions", () => ({
  DocumentActionButton: ({
    kind,
    documentId,
    autoOpen,
  }: {
    kind: string;
    documentId: string;
    autoOpen: boolean;
  }) => {
    received.kind = kind;
    received.id = documentId;
    received.autoOpen = autoOpen;
    return <button>Gestionar</button>;
  },
}));

import DocumentActionPage from "./page";

describe("DocumentActionPage", () => {
  it("abre el documento exacto indicado por la ruta server-owned", async () => {
    const element = await DocumentActionPage({
      params: Promise.resolve({ kind: "payable", id: "payable-123" }),
    });

    expect(renderToStaticMarkup(element)).toContain("Gestionar pago");
    expect(received).toEqual({ kind: "payable", id: "payable-123", autoOpen: true });
  });
});
