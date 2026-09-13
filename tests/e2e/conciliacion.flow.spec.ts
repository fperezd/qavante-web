import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

/* La ruta histórica de conciliación conserva su intención dentro de Bandeja V07. El flujo compara
   movimiento y documento, permite confirmar o descartar y nunca muestra el puntaje interno. */

async function abrirConciliacion(page: Page, context: BrowserContext) {
  await loginAs(context, "owner");
  await page.goto("/caja/conciliacion");
  await expect(page.getByRole("heading", { level: 1, name: /pendientes/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Conciliar/ })).toBeChecked();
  await expect(page.getByRole("region", { name: "Excepción por conciliar" })).toBeVisible();
}

test.describe("Flujo: conciliar desde la Bandeja V07", () => {
  test("muestra movimiento, documento y monto sin calificaciones internas", async ({
    page,
    context,
  }) => {
    await abrirConciliacion(page, context);

    await expect(page.getByText("ABONO CLIENTE FACTURA 1042")).toBeVisible();
    await expect(page.getByRole("heading", { name: /X Capital SpA/ })).toBeVisible();
    await expect(page.getByText("$1.190.000", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/de certeza|confianza/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sí, conciliar/ })).toBeVisible();
  });

  test("confirma el documento sugerido, avanza y ofrece la reversión real", async ({
    page,
    context,
  }) => {
    await abrirConciliacion(page, context);

    await page.getByRole("button", { name: /Sí, conciliar/ }).click();

    await expect(page.getByText(/Conciliado:/).first()).toBeVisible();
    await expect(page.getByText(/1 de \d+ resueltos en esta sesión/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
  });

  test("descarta una sugerencia y avanza sin afirmar que concilió", async ({ page, context }) => {
    await abrirConciliacion(page, context);

    await page.getByRole("button", { name: /No es esta/ }).click();

    await expect(page.getByText(/Descartada la sugerencia/).first()).toBeVisible();
    await expect(page.getByText(/Conciliado:/)).toHaveCount(0);
    await expect(page.getByText(/1 de \d+ resueltos en esta sesión/)).toBeVisible();
  });
});
