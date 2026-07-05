import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — vincular una cuenta bancaria (handoff CC-API). Cuando BICE trae una
   cuenta en cuarentena (linked_bank_account_id null), el dueño la vincula en UN
   clic (crea la cuenta Qavante + linkea). MSW sirve una cuenta por vincular. */

test.describe("Flujo: vincular cuentas del banco (/administracion/credenciales)", () => {
  test("vincula una cuenta en un clic → confirmación", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/credenciales");

    // La cuenta en cuarentena aparece con su botón "Vincular".
    const vincular = page.getByRole("button", { name: /^Vincular$/ }).first();
    await expect(vincular).toBeVisible();
    await vincular.click();

    // Toast de confirmación (crea + linkea detrás).
    await expect(page.getByText(/Cuenta vinculada/i)).toBeVisible();
  });
});
