import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Resultado Operacional de Gestión (Sprint C5). Pantalla construida
   FE-first contra MSW (el endpoint backend aún no existe), gated por
   `operationalResult` (ON en el env de e2e para poder testearla). Valida
   render del resultado + desglose + drivers + navegación de período. */

test.describe("Flujo: Resultado Operacional (/gestion)", () => {
  test("muestra el resultado, el badge y navega de período", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");

    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // Badge obligatorio (Maestro §7.5): no es contabilidad oficial.
    await expect(page.getByText(/no es contabilidad oficial/i)).toBeVisible();

    // Resultado del mes + desglose (datos de MSW).
    await expect(page.getByText("Resultado operacional del mes")).toBeVisible();
    await expect(page.getByText("Ingresos")).toBeVisible();
    await expect(page.getByText("EBITDA (proxy)")).toBeVisible();
    // Drivers (qué explica el resultado).
    await expect(page.getByText("Qué explica el resultado")).toBeVisible();

    // Navegación de período: el label "mmm YYYY" cambia al ir al mes anterior.
    const monthRe = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}$/i;
    const label = page.getByText(monthRe);
    const before = await label.textContent();
    await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect.poll(async () => (await label.textContent()) !== before).toBe(true);
  });
});
