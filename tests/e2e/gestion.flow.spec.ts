import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Resultado Operacional de Gestión v2 (rediseño 2026-07-14, `gestionV2` ON en prod y en
   el env de e2e). Un mes → la vista v2 (respuesta de dueño + cascada + drivers); el rango sigue
   con la matriz mensual clásica. Contra MSW (operational-result + breakdown + dashboard). */

test.describe("Flujo: Resultado Operacional v2 (/gestion)", () => {
  test("un mes muestra la respuesta de dueño + cascada; el rango muestra la matriz", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");

    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // Badge obligatorio (Maestro §7.5): no es contabilidad oficial.
    await expect(page.getByText(/no es contabilidad oficial/i)).toBeVisible();

    // Un mes por defecto: vista v2 — respuesta de dueño (result del fixture = $3.900.000) + cascada.
    await expect(page.getByText("El negocio ganó este mes")).toBeVisible();
    // El resultado ($3.900.000) aparece en el hero Y en la cascada — coinciden (footing correcto).
    await expect.poll(() => page.getByText("$3.900.000").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Ingresos")).toBeVisible();
    await expect(page.getByText("$18.500.000")).toBeVisible(); // Ingresos, único
    await expect(page.getByText("Qué explica el resultado")).toBeVisible();
    await expect(page.getByText("Más ventas que el mes anterior.")).toBeVisible(); // driver (texto único)

    // Selector de rango (pedido de Fernando): elegir "Tres meses" → vista de rango.
    await page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: /20\d{2}/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Elegir rango de períodos" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Tres meses" }).click();

    // Vista de rango v2: respuesta de dueño del período + margen en el tiempo (protagonista)…
    await expect(page.getByText("El negocio ganó en el período")).toBeVisible();
    await expect(page.getByText("Márgenes del período")).toBeVisible();
    await expect(page.getByText("Margen operacional en el tiempo")).toBeVisible();
    // …y la matriz P&L mes a mes (Chipax) debajo — filas jerárquicas + "(proforma)".
    await expect(page.getByText("Total Ingresos")).toBeVisible();
    // exact: la fila de la matriz "Margen Bruto" ≠ el bloque v2 "Margen bruto".
    await expect(page.getByText("Margen Bruto", { exact: true })).toBeVisible();
    await expect(page.getByText("(proforma)")).toBeVisible();
    await expect(page.getByText("Proyectos")).toBeVisible(); // fila hija, expandida por default
  });
});
