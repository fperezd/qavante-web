import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SourceStatus } from "@/lib/api/sources-status";
import { SourceRow } from "./sync-status-indicator";

describe("SourceRow — frontera de mensajes", () => {
  it("clasifica reason sin renderizar prosa libre de la fuente", () => {
    const secreto = "Bearer secret-token SELECT * FROM users /api/internal";
    const source: SourceStatus = {
      source: "sii_rcv",
      display_name: "SII",
      state: "error",
      last_sync: null,
      reason: secreto,
    };

    const html = renderToStaticMarkup(<SourceRow source={source} />);
    expect(html).not.toContain(secreto);
    expect(html).toContain("El último intento de leer esta fuente falló");
  });
});
