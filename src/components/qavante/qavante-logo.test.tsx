import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QavanteLogo } from "./qavante-logo";

describe("QavanteLogo", () => {
  it("publica la marca completa y su lema en hero", () => {
    const html = renderToStaticMarkup(<QavanteLogo variant="hero" />);

    expect(html).toContain("/qavante-logo-full.png");
    expect(html).toContain("Anticipa. Decide. Avanza.");
  });

  it("usa el wordmark compacto en el encabezado", () => {
    const html = renderToStaticMarkup(<QavanteLogo variant="header" alt="Inicio" />);

    expect(html).toMatch(/src="\/qavante-logo\.png(?:\?[^\"]*)?"/);
    expect(html).toContain('alt="Inicio"');
    expect(html).not.toContain("qavante-logo-full.png");
  });
});
