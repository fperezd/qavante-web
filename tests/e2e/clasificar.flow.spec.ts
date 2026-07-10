import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — clasificar un movimiento bancario (Addendum §17,
   pantalla LIVE en prod). Maneja el formulario contra MSW, no solo render:
   abre el drawer, elige una categoría de gestión y guarda. Cubre el loop
   central del producto (el balde más débil del DoD: e2e de flujos reales).

   Flag `bankMovementClassification` ON vía playwright.config (espeja prod).
   La fixture MSW sirve movimientos sin clasificar + el árbol de cuentas. */

test.describe("Flujo: clasificar un movimiento (/caja/por-clasificar)", () => {
  test("abre el drawer, elige categoría de gestión y guarda → cierra", async ({
    page,
    context,
  }) => {
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

  test("triage por teclado: Enter en la lista abre el drawer del activo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    // La lista es un listbox navegable por teclado (↑↓ mover, Enter clasificar).
    const list = page.getByRole("listbox", { name: "Movimientos por clasificar" });
    await expect(list).toBeVisible();

    // `press` enfoca la lista y dispara Enter → abre el drawer del movimiento activo.
    await list.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Clasificar movimiento", exact: true }),
    ).toBeVisible();
  });

  test("clasificar en lote: seleccionar todos → aplicar una categoría a todos", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    // Seleccionar todos → aparece la barra de lote con el conteo.
    await page.getByRole("checkbox", { name: "Seleccionar todos los movimientos" }).check();
    const openBulk = page.getByRole("button", { name: /^Clasificar \d+$/ }).first();
    await expect(openBulk).toBeVisible();
    await openBulk.click();

    // Diálogo del lote: elegir cuenta y aplicar.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Clasificar \d+ movimiento/ })).toBeVisible();
    await dialog.getByLabel("Cuenta de gestión").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: /^Clasificar \d+$/ }).click();

    // Confirmación (toast) de los movimientos clasificados.
    await expect(page.getByText(/movimientos? clasificados?/i)).toBeVisible();
  });

  test("aplicar reglas: batch clasifica los sin clasificar y confirma con toast", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    const aplicar = page.getByRole("button", { name: "Aplicar reglas", exact: true });
    await expect(aplicar).toBeVisible();
    await aplicar.click();

    // MSW devuelve clasificados:5 de evaluados:12 → toast de éxito con el conteo.
    await expect(page.getByText(/Clasificamos 5 de 12 movimientos con tus reglas/)).toBeVisible();
  });

  test("cancelar cierra el drawer sin guardar", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/por-clasificar");

    await page
      .getByRole("button", { name: /^Clasificar movimiento/ })
      .first()
      .click();
    const drawerTitle = page.getByRole("heading", { name: "Clasificar movimiento", exact: true });
    await expect(drawerTitle).toBeVisible();

    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(drawerTitle).toBeHidden();
  });
});
