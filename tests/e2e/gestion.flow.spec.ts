import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Resultado Operacional de Gestión (Sprint C5). Pantalla construida
   FE-first contra MSW (el endpoint backend aún no existe), gated por
   `operationalResult` (ON en el env de e2e para poder testearla). Valida
   render del resultado + desglose + drivers + navegación de período. */

test.describe("Flujo: Resultado Operacional (/gestion)", () => {
  test("muestra el resultado del mes y permite verlo por rango", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");

    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // Badge obligatorio (Maestro §7.5): no es contabilidad oficial.
    await expect(page.getByText(/no es contabilidad oficial/i)).toBeVisible();

    // Un mes por defecto: vista rica (desglose fino + drivers).
    await expect(page.getByText("Resultado operacional del mes")).toBeVisible();
    await expect(page.getByText("Ingresos")).toBeVisible();
    await expect(page.getByText("EBITDA (proxy)")).toBeVisible();
    await expect(page.getByText("Qué explica el resultado")).toBeVisible();

    // Selector de rango (pedido de Fernando): elegir "Tres meses" → vista de rango.
    await page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: /20\d{2}/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Elegir rango de períodos" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Tres meses" }).click();

    // Vista de rango: total del período + mes a mes.
    await expect(page.getByText("Resultado operacional del período")).toBeVisible();
    await expect(page.getByText("Mes a mes")).toBeVisible();
  });
});
