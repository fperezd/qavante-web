import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Credenciales ya no ofrece el vínculo BICE de un clic. Los bancos de la empresa
   se conectan por Fintoc desde esta misma pantalla. */

test.describe("Flujo: bancos en credenciales (/administracion/credenciales)", () => {
  test("muestra los bancos de la empresa y la conexión Fintoc", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/credenciales");

    await expect(page.getByRole("heading", { name: "Bancos de la empresa" })).toBeVisible();
    await expect(
      page.getByText(/Conecta una o más instituciones a través de Fintoc/),
    ).toBeVisible();
  });
});
