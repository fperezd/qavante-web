import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* La administración de bancos se conecta desde /banco; credenciales solo lista
   las conexiones existentes y permite gestionar consentimientos. */

test.describe("Flujo: bancos en credenciales (/administracion/credenciales)", () => {
  test("muestra los bancos de la empresa y la gestión de conexiones", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/credenciales");

    await expect(page.getByRole("heading", { name: "Bancos de la empresa" })).toBeVisible();
    await expect(
      page.getByText(/Administra aquí tus conexiones bancarias/),
    ).toBeVisible();
  });
});
