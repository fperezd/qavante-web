import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Flujo: Gestión de cobros documental (/cobrar)", () => {
  test.beforeEach(async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");
  });

  test("publica KPIs y documentos sin mezclar las monedas", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Gestión de cobros" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Resumen de cobranza" })).toContainText(
      "$4.000.000",
    );
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Comercial del Sur Ltda/ })).toBeVisible();
  });

  test("separa documentos sin vencimiento confirmado de la mora", async ({ page }) => {
    await page.getByRole("radio", { name: "Sin vencimiento" }).click();
    await expect(page.getByRole("row", { name: /Comercial del Sur Ltda/ })).toContainText(
      "Sin vencimiento confirmado",
    );
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toHaveCount(0);
  });

  test("permite auditar cedidas pero no seleccionarlas para cobranza", async ({ page }) => {
    await page.getByRole("button", { name: "Cedidas" }).click();
    const cedida = page.getByRole("row", { name: /Minera Atacama SA/ });
    await expect(cedida).toBeVisible();
    await expect(cedida.getByRole("checkbox")).toBeDisabled();
  });

  test("envía un recordatorio manual sólo para documentos elegibles", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Seleccionar 1234" }).check();
    await page.getByRole("button", { name: "Enviar recordatorio" }).click();
    await expect(page.getByText("1 recordatorio enviado")).toBeVisible();
  });

  test("expone las tres plantillas automáticas y su vista previa", async ({ page }) => {
    await page.goto("/cobrar/recordatorios");
    for (const title of [
      "Recordatorio previo",
      "Recordatorio de vencimiento",
      "Recordatorio de mora",
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Ver correo" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
