import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B28 — QA E2E de Fernando contra producción (2026-10-05): la pantalla pedía subir una cartola y
   NO tenía con qué hacerlo; la acción vivía en Administración → Credenciales. Una instrucción sin
   su acción en la misma página es una instrucción que el usuario no puede cumplir.

   Los dos componentes se doblan: acá se fija la COMPOSICIÓN de la página (que la acción esté junto
   a la lista, y que detrás del flag apagado no esté ninguna de las dos), no su interior. */

const arnes = vi.hoisted(() => ({ bankMovementClassification: true }));

vi.mock("@/lib/feature-flags", () => ({
  resolveFeatureFlags: () => ({
    bankMovementClassification: arnes.bankMovementClassification,
  }),
}));

vi.mock("@/components/caja/foreign-purchases-view", () => ({
  ForeignPurchasesView: () => <div data-testid="compras">Compras al extranjero</div>,
}));

vi.mock("@/components/credenciales", () => ({
  CardStatementUpload: () => <div data-testid="subir-cartola">Subir cartola</div>,
}));

import CajaComprasExtranjeroPage from "./page";

describe("CajaComprasExtranjeroPage", () => {
  it("ofrece subir la cartola EN la misma página que pide subirla", () => {
    arnes.bankMovementClassification = true;
    const html = renderToStaticMarkup(<CajaComprasExtranjeroPage />);
    expect(html).toContain('data-testid="compras"');
    expect(html).toContain('data-testid="subir-cartola"');
  });

  it("GEMELO: con el flag apagado no aparece ni la lista ni la acción", () => {
    arnes.bankMovementClassification = false;
    const html = renderToStaticMarkup(<CajaComprasExtranjeroPage />);
    expect(html).not.toContain('data-testid="compras"');
    expect(html).not.toContain('data-testid="subir-cartola"');
  });
});
