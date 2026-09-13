import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CajaMedidorSinDato } from "./caja-medidor";

describe("CajaMedidorSinDato · INV-DEC-010", () => {
  it("lleva a conexiones cuando falta evidencia para proyectar, no a trabajo manual", () => {
    const html = renderToStaticMarkup(<CajaMedidorSinDato ultimaSync="12 sep" />);

    expect(html).toContain("Todavía no hay suficiente movimiento para proyectar");
    expect(html).toContain("Revisar conexiones");
    expect(html).toContain('href="/conexiones"');
    expect(html).not.toContain("Clasificar");
  });
});
