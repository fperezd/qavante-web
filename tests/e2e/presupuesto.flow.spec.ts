import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Presupuesto propositivo (ADR-0091, `presupuesto` ON). "El presupuesto se PROPONE desde tu
   historial; vos lo ajustás." Contra MSW (budget-vs-actual con has_budget:true): el hero "¿cómo vas?"
   muestra el resultado real vs plan + el semáforo, y los chips de ajuste "+% ventas". */

test.describe("Flujo: Presupuesto (/presupuesto)", () => {
  test("hero '¿cómo vas?' con semáforo + ajuste +% ventas", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/presupuesto");

    await expect(page.getByRole("heading", { level: 1, name: "Presupuesto" })).toBeVisible();

    // Hero: la pregunta del dueño + el semáforo (result −47% vs plan del fixture).
    await expect(page.getByText(/¿Cómo vas en/i)).toBeVisible();
    await expect(page.getByText(/vs plan/i)).toBeVisible();

    // Franja de origen + chips de ajuste propositivo.
    await expect(page.getByText(/Lo armó Qavante desde tu/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /\+8% ventas/i })).toBeVisible();

    // Toggle Mes / Año.
    await expect(page.getByRole("tab", { name: "Año" })).toBeVisible();
  });
});
