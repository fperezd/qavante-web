import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Banco V03 activo en producción: cuentas y tarjetas en una tabla, con una cartola filtrable sin
   mezclar monedas. Los detalles históricos siguen siendo destinos válidos. */

test.describe("Flujo: Banco (/banco)", () => {
  test("muestra el banco con sus cuentas y tarjetas de crédito", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/banco");

    await expect(
      page.getByRole("heading", { level: 1, name: "Tus cuentas y tarjetas" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Cuentas" })).toBeVisible();
    await expect(page.getByText(/Cuenta Corriente/).first()).toBeVisible();
    await expect(page.getByText(/Tarjeta de Cr/).first()).toBeVisible();
    await expect(page.getByText(/Las monedas no se suman entre sí/)).toBeVisible();
    await expect(page.getByRole("region", { name: /Cartola/ })).toBeVisible();
  });

  test("el ítem 'Banco' aparece en el menú lateral", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");
    await expect(page.getByRole("link", { name: "Banco" })).toBeVisible();
  });

  test("clic en la cuenta → detalle de movimientos con filtro de mes", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/banco");

    const accountLink = page.locator('a[href="/banco/cuenta/tok-cc-clp"]');
    await expect(accountLink).toBeVisible();
    await Promise.all([page.waitForURL("**/banco/cuenta/tok-cc-clp"), accountLink.click()]);
    await expect(page.getByText("Volver a Banco")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mes actual" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();

    // Elegir mayo 2026 (mes con movimientos en el fixture) → aparecen los movimientos de la cuenta.
    await page.locator('input[type="month"]').fill("2026-05");
    await expect(page.getByText(/SUELDO FERNANDO PEREZ|MOVISTAR/).first()).toBeVisible();

    // Tabs estilo Chipax (Fase 1): Todos / Abonos / Cargos / Por conciliar. Filtrar por "Cargos".
    await expect(page.getByRole("tab", { name: /Por conciliar/ })).toBeVisible();
    await page.getByRole("tab", { name: /Cargos/ }).click();
    await expect(page.getByText(/SUELDO FERNANDO PEREZ|MOVISTAR/).first()).toBeVisible();
  });

  test("Fase 2: conciliar un movimiento desde su match propuesto", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/banco");
    const accountLink = page.locator('a[href="/banco/cuenta/tok-cc-clp"]');
    await expect(accountLink).toBeVisible();
    await Promise.all([page.waitForURL("**/banco/cuenta/tok-cc-clp"), accountLink.click()]);
    await page.locator('input[type="month"]').fill("2026-05");

    // La cola de conciliación tiene un match para un movimiento de la cuenta (mov-unclas-2) → aparece
    // el tab "Sugerencias" y, bajo el movimiento por conciliar, el match propuesto.
    await expect(page.getByRole("tab", { name: /Sugerencias/ })).toBeVisible();
    // Nombre del documento sugerido en su span (exact: la glosa "ABONO CLIENTE X CAPITAL SPA" también
    // contiene el texto, así que evitamos el match por substring).
    await expect(page.getByText("X Capital SpA", { exact: true })).toBeVisible();
    await expect(page.getByText(/de certeza|confianza/i)).toHaveCount(0);

    // El tab "Sugerencias" deja solo el movimiento con match.
    await page.getByRole("tab", { name: /Sugerencias/ }).click();
    await expect(page.getByText("ABONO CLIENTE FACTURA 1042")).toBeVisible();

    // Conciliar → confirma y avisa (toast).
    await page.getByRole("button", { name: "Conciliar" }).click();
    await expect(page.getByText("Conciliado.")).toBeVisible();
  });

  test("clic en la tarjeta → detalle de movimientos", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/banco");

    const cardLink = page.locator('a[href="/banco/tarjeta/42595474000067584"]');
    await expect(cardLink).toBeVisible();
    await Promise.all([page.waitForURL("**/banco/tarjeta/42595474000067584"), cardLink.click()]);
    await expect(page.getByText("Volver a Banco")).toBeVisible();
    await page.locator('input[type="month"]').fill("2026-08");
    await expect(page.getByText("MERCADOLIBRE")).toBeVisible();
  });
});
