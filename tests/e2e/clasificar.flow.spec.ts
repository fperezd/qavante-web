import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — clasificar un movimiento bancario (Addendum §17,
   pantalla LIVE en prod). Maneja el formulario contra MSW, no solo render:
   abre el drawer, elige una categoría de gestión y guarda. Cubre el loop
   central del producto (el balde más débil del DoD: e2e de flujos reales).

   Flag `bankMovementClassification` ON vía playwright.config (espeja prod).
   La fixture MSW sirve movimientos sin clasificar + el árbol de cuentas. */

test.describe("Flujo: clasificar un movimiento (/caja/por-clasificar)", () => {
  test("abre el drawer, elige categoría de gestión y guarda → cierra", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    // La pantalla (no FeatureUnavailableState) y la lista de movimientos.
    await expect(
      page.getByRole("heading", { level: 1, name: "Movimientos por clasificar" }),
    ).toBeVisible();
    const clasificar = page.getByRole("button", { name: /^Clasificar movimiento/ }).first();
    await expect(clasificar).toBeVisible();

    // Abrir el drawer de clasificación.
    await clasificar.click();
    const drawerTitle = page.getByRole("heading", { name: "Clasificar movimiento", exact: true });
    await expect(drawerTitle).toBeVisible();

    // "Guardar" arranca deshabilitado: falta la categoría de gestión (422 sin
    // management_account_id — el contrato la exige).
    const guardar = page.getByRole("button", { name: "Guardar", exact: true });
    await expect(guardar).toBeDisabled();

    // Elegir una cuenta de gestión (botón en la lista del selector, del árbol
    // que sirve MSW: "Ventas de productos" es una hoja activa/seleccionable).
    await page.getByRole("button", { name: "Ventas de productos", exact: true }).click();

    // Ahora se habilita; guardar → classify (PATCH MSW) → onSuccess cierra.
    await expect(guardar).toBeEnabled();
    await guardar.click();
    await expect(drawerTitle).toBeHidden();
  });

  test("cancelar cierra el drawer sin guardar", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    await page.getByRole("button", { name: /^Clasificar movimiento/ }).first().click();
    const drawerTitle = page.getByRole("heading", { name: "Clasificar movimiento", exact: true });
    await expect(drawerTitle).toBeVisible();

    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(drawerTitle).toBeHidden();
  });
});
