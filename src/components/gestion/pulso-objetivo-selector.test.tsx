import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PulsoObjetivoSelector } from "./pulso-objetivo-selector";

function text(applicationState: "applied" | "not_applied"): string {
  return renderToStaticMarkup(
    <PulsoObjetivoSelector value="crecer" onChange={vi.fn()} applicationState={applicationState} />,
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("PulsoObjetivoSelector", () => {
  it("afirma el foco sólo cuando el contrato lo aplicó", () => {
    expect(text("applied")).toContain("Este foco sí está aplicado al corte mostrado.");
  });

  it("declara la abstención cuando el foco solicitado no fue efectivo", () => {
    const rendered = text("not_applied");
    expect(rendered).toContain("Este corte no permite aplicar el foco");
    expect(rendered).toContain("mostramos el Pulso base sin reponderarlo");
    expect(rendered).not.toContain("sí está aplicado");
  });
});
