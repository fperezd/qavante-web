import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SourceStatus } from "@/lib/api/sources-status";
import { ConexionesTabla } from "./conexiones-view";

describe("ConexionesTabla — frontera de mensajes", () => {
  it("no renderiza reason libre de la fuente", () => {
    const secreto = "Bearer secret-token SELECT * FROM users /api/internal";
    const source: SourceStatus = {
      source: "sii_rcv",
      display_name: "SII",
      state: "error",
      last_sync: null,
      reason: secreto,
    };

    const html = renderToStaticMarkup(<ConexionesTabla sources={[source]} />);
    expect(html).not.toContain(secreto);
    expect(html).not.toContain("Detalle técnico");
    expect(html).toContain("El último intento de leer esta fuente falló");
    expect(html).toContain("Revisa la conexión e intenta nuevamente");
  });
});
