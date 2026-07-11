import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — el logo Qavante del header vuelve al Inicio (patrón estándar). */

test.describe("Flujo: logo del header → Inicio", () => {
  test("clic en el logo desde otra pantalla navega a /inicio", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");
    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    await page.getByRole("link", { name: "Ir al Inicio" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
  });
});
