import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — pantalla Banco (gated `bancoScreen`, ON en el e2e). Los productos del tenant por banco:
   cuentas corrientes (saldo + línea de crédito) + tarjetas de crédito (cupo). Contra MSW (bice). */

test.describe("Flujo: Banco (/banco)", () => {
  test("muestra el banco con sus cuentas y tarjetas de crédito", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/banco");

    await expect(page.getByRole("heading", { level: 1, name: "Banco" })).toBeVisible();

    // Sección del banco (BICE) con sus dos grupos de productos. (Regex sin tildes: evita el mismatch de
    // normalización Unicode de la "é" entre el string del test y el DOM.)
    await expect(page.getByRole("region", { name: "Banco BICE" })).toBeVisible();
    await expect(page.getByText("Cuentas corrientes")).toBeVisible();
    await expect(page.getByText(/Tarjetas de cr/).first()).toBeVisible();

    // La cuenta corriente con su saldo (la línea de crédito la cubren unit + story).
    await expect(page.getByText("Cuenta Corriente", { exact: true })).toBeVisible();
    await expect(page.getByText(/disponible/).first()).toBeVisible();

    // Una tarjeta de crédito con su cupo disponible.
    await expect(page.getByText(/Tarjeta de Cr/).first()).toBeVisible();
    await expect(page.getByText(/Disponible/).first()).toBeVisible();
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

    // La cuenta es clickeable (regla "todo clickeable a detalle").
    await page.getByRole("link", { name: /Ver movimientos de Cuenta Corriente/ }).click();
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
    await page.getByRole("link", { name: /Ver movimientos de Cuenta Corriente/ }).click();
    await page.locator('input[type="month"]').fill("2026-05");

    // La cola de conciliación tiene un match para un movimiento de la cuenta (mov-unclas-2) → aparece
    // el tab "Sugerencias" y, bajo el movimiento por conciliar, el match propuesto.
    await expect(page.getByRole("tab", { name: /Sugerencias/ })).toBeVisible();
    // Nombre del documento sugerido en su span (exact: la glosa "ABONO CLIENTE X CAPITAL SPA" también
    // contiene el texto, así que evitamos el match por substring).
    await expect(page.getByText("X Capital SpA", { exact: true })).toBeVisible();
    await expect(page.getByText(/83% de certeza/)).toBeVisible();

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

    await page
      .getByRole("link", { name: /Ver movimientos de Tarjeta de Cr/ })
      .first()
      .click();
    await expect(page.getByText("Volver a Banco")).toBeVisible();
    await page.locator('input[type="month"]').fill("2026-08");
    await expect(page.getByText("MERCADOLIBRE")).toBeVisible();
  });
});
