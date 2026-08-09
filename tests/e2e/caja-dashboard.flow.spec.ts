import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Caja como landing REORDENABLE (`cajaDashboard`, ON en el env de e2e; OFF en prod hasta que
   Fernando lo valide). El dashboard muestra las MISMAS secciones que la landing clásica (resumen v2 +
   movimientos), pero como bloques movibles/apagables (motor iPad del Inicio: asa de arrastre + "x" para
   ocultar). Verificamos que el contenido sigue + que aparecen los controles de reordenar/ocultar. */

test.describe("Flujo: Caja reordenable (/caja, cajaDashboard)", () => {
  test("las secciones se muestran como bloques movibles/apagables", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");

    await expect(page.getByRole("heading", { level: 1, name: "Caja" })).toBeVisible();

    // Mismo contenido que la landing clásica (el dashboard no cambia los datos, solo los hace movibles).
    await expect(page.getByText("La empresa tiene en caja")).toBeVisible();
    await expect(page.getByText("Por clasificar")).toBeVisible();

    const main = page.locator("#main-content");
    // Cada bloque trae su asa de arrastre y su "x" de ocultar (siempre en el DOM; visibles atenuadas).
    await expect(main.getByRole("button", { name: /para reordenar/ }).first()).toBeAttached();
    await expect(main.getByRole("button", { name: /^Ocultar /i }).first()).toBeAttached();
  });
});
