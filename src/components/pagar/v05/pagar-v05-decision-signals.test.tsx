import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOY, pagos } from "./pagar-v05-fixtures";
import { pagosV05 } from "./pagar-v05-model";
import { PagarV05View } from "./pagar-v05-view";

/* Cableado de `includeDecisionSignals` en la vista (#302 P3). El modelo ya fija qué hace la
   opción (`pagar-v05-model.test.ts`); acá se fija que la VISTA la enciende y la apaga con
   `suppressRecommendations`, junto con el orden, y que la tabla acompaña (columna "Tipo"). */

vi.mock("./pagar-v05-model", async (importOriginal) => {
  const real = await importOriginal<typeof import("./pagar-v05-model")>();
  return { ...real, pagosV05: vi.fn(real.pagosV05) };
});

const pagosV05Spy = vi.mocked(pagosV05);

function ultimaOpcion() {
  const llamada = pagosV05Spy.mock.calls.at(-1);
  if (!llamada) throw new Error("la vista no derivó las filas con pagosV05");
  return llamada[3];
}

describe("PagarV05View — cableado de includeDecisionSignals", () => {
  afterEach(() => pagosV05Spy.mockClear());

  it("sin Brief: señales de decisión encendidas y orden por urgencia", () => {
    const html = renderToStaticMarkup(<PagarV05View pagos={pagos()} hoy={HOY} />);
    expect(ultimaOpcion()).toEqual({ order: "urgency", includeDecisionSignals: true });
    expect(html).toContain(">Tipo<");
  });

  it("con Brief: señales apagadas y orden de la fuente (control negativo del cableado)", () => {
    const html = renderToStaticMarkup(
      <PagarV05View pagos={pagos()} hoy={HOY} suppressRecommendations />,
    );
    expect(ultimaOpcion()).toEqual({ order: "source", includeDecisionSignals: false });
    expect(html).not.toContain(">Tipo<");
  });
});
