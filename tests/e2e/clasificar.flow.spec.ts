import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

/* La ruta histórica conserva el marcador, pero con Bandeja V07 activa presenta la experiencia
   vigente de clasificación: una decisión por vez y sin prometer Deshacer para decisiones manuales. */

async function abrirClasificacion(page: Page, context: BrowserContext) {
  await loginAs(context, "owner");
  await page.goto("/caja/por-clasificar");
  await expect(page.getByRole("heading", { level: 1, name: /pendientes/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Clasificar/ })).toBeChecked();
  await expect(page.getByRole("region", { name: "Excepción por clasificar" })).toBeVisible();
}

test.describe("Flujo: clasificar desde la Bandeja V07", () => {
  test("la ruta histórica abre la pestaña correcta y una sola decisión", async ({
    page,
    context,
  }) => {
    await abrirClasificacion(page, context);

    await expect(page.getByText(/Clasificar 1 de 4/)).toBeVisible();
    await expect(page.getByLabel("Tipo de movimiento")).toBeVisible();
    await expect(page.getByLabel("Cuenta de gestión")).toBeVisible();
    await expect(page.getByRole("button", { name: /Guardar/ })).toBeVisible();

    /* B21 — la cuenta se ofrece CON su código, que es lo que el contador reconoce, y las que
       agrupan a otras no se pueden elegir: imputar a "Costos directos" no es imputar a nada. */
    const cuenta = page.getByLabel("Cuenta de gestión");
    await expect(cuenta.locator("option", { hasText: "Software y servicios" })).toHaveText(
      /costos\.servicios · Software y servicios/,
    );
    const agrupadora = cuenta.locator("option", { hasText: "Costos operacionales" }).first();
    await expect(agrupadora).toHaveText(/agrupa a otras cuentas/);
    await expect(agrupadora).toBeDisabled();
  });

  test("elige tipo y cuenta, guarda y avanza sin ofrecer un Deshacer falso", async ({
    page,
    context,
  }) => {
    await abrirClasificacion(page, context);

    await page.getByLabel("Tipo de movimiento").selectOption({ label: "Pago a proveedor" });
    await page
      .getByLabel("Cuenta de gestión")
      .selectOption({ label: "costos.servicios · Software y servicios" });
    await page.getByRole("button", { name: /Guardar/ }).click();

    await expect(page.getByText(/Clasificado como Software y servicios/).first()).toBeVisible();
    await expect(page.getByText(/Clasificar 1 de 3/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Deshacer" })).toHaveCount(0);
  });

  test("Guardar explica qué falta cuando no se eligió el tipo", async ({ page, context }) => {
    await abrirClasificacion(page, context);

    await page.getByLabel("Tipo de movimiento").selectOption("");
    await page.getByRole("button", { name: /Guardar/ }).click();

    await expect(
      page.getByText("Elige el tipo de movimiento para completar la clasificación."),
    ).toBeVisible();
  });

  test("clasifica un grupo sólo después de revisar y confirmar los tres movimientos", async ({
    page,
    context,
  }) => {
    await abrirClasificacion(page, context);

    await expect(page.getByText(/Hay 2 más de .*TRANSFERENCIA PROVEEDOR ACME SPA/)).toBeVisible();
    await page.getByRole("button", { name: /Revisar los 3 seguidos/ }).click();
    await page.getByLabel("Tipo de movimiento").selectOption({ label: "Pago a proveedor" });
    await page
      .getByLabel("Cuenta de gestión")
      .selectOption({ label: "costos.servicios · Software y servicios" });
    await page.getByRole("button", { name: "Clasificar 3 de una vez" }).click();

    const confirmation = page.getByRole("alert").filter({
      hasText: "Vas a clasificar 3 movimientos",
    });
    await expect(confirmation).toContainText(
      "Vas a clasificar 3 movimientos como Pago a proveedor · Software y servicios",
    );
    const requestSent = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/api/treasury/bank-movements/classify-bulk"),
    );
    await confirmation.getByRole("button", { name: "Sí, clasificar 3" }).click();
    const request = await requestSent;
    const body = request.postDataJSON() as {
      movement_ids: string[];
      management_account_id: string;
      canonical_category: string;
      idempotency_key: string;
    };
    expect(body).toMatchObject({
      movement_ids: ["mov-unclas-1", "mov-unclas-3", "mov-unclas-4"],
      management_account_id: "acc-servicios",
      canonical_category: "supplier_payment",
    });
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(
      page.getByText(/Clasificamos 3 movimientos como Software y servicios/),
    ).toBeVisible();
  });
});
