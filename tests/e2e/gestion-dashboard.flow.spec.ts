import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión como tablero REORDENABLE (`gestionDashboard`, ON en prod #894 y en el env de e2e). La
   vista de mes único muestra sus secciones (resultado/hero, márgenes, comparativos, cascada, drivers…)
   como bloques movibles/apagables (motor iPad del Inicio). Verificamos que el contenido de dueño sigue
   (mismo que el informe) + que cada bloque trae los controles de reordenar/ocultar. El rango y el mes en
   curso NO usan el tablero (siguen como informe/reframe) — cubiertos por gestion.flow.spec. */

test.describe("Flujo: Gestión reordenable (/gestion, gestionDashboard)", () => {
  test("las secciones del mes se muestran como bloques movibles/apagables", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");

    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // El contenido de dueño sigue igual que en el informe (el tablero solo lo hace movible).
    await expect(page.getByText("El negocio ganó este mes")).toBeVisible();
    await expect(page.getByText("Qué explica el resultado")).toBeVisible();

    const main = page.locator("#main-content");
    // Cada bloque trae su asa de arrastre y su "x" de ocultar (siempre en el DOM).
    await expect(main.getByRole("button", { name: /para reordenar/ }).first()).toBeAttached();
    await expect(main.getByRole("button", { name: /^Ocultar /i }).first()).toBeAttached();
  });
});
