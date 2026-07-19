import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Honorarios recibidos (/pagar/honorarios-recibidos). BHE del SII (gated
   `siiQueries`, ON en el env de e2e) contra MSW. Auto-carga por rango; valida el header y
   que carguen las boletas del período (por emisor). */

test.describe("Flujo: Honorarios recibidos (BHE)", () => {
  test("carga las boletas del SII por profesional", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/honorarios-recibidos");

    await expect(page.getByRole("heading", { name: "Honorarios recibidos" })).toBeVisible();
    // Boletas del fixture (auto-carga por rango).
    await expect(page.getByText("Profesional Asesor 1").first()).toBeVisible();
    await expect(page.getByText("Estudio Jurídico XYZ").first()).toBeVisible();
  });
});
