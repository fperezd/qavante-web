import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — editor de estructura de gestión (cuentas), pantalla
   LIVE en prod (CRUD completo). Maneja el dialog de creación contra MSW:
   abre "Nueva cuenta", completa el form (código/nombre/tipo/destino) y crea.

   Flag `managementAccounts` ON vía playwright.config (espeja prod). La fixture
   MSW sirve el árbol (Ingresos > Ventas de productos, Costos…) y acepta el
   POST de creación. Tipos presentes en el árbol: income/expense; destino:
   operational_income_statement (de ahí salen las opciones de los selects). */

test.describe("Flujo: editor de estructura de gestión (/administracion/estructura-gestion)", () => {
  test("crea una cuenta: abre el dialog, completa y crea → cierra", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/estructura-gestion");

    // El árbol cargó (no FeatureUnavailableState).
    await expect(page.getByText("Ingresos").first()).toBeVisible();

    // Abrir el dialog de creación (cuenta raíz).
    await page.getByRole("button", { name: "Nueva cuenta", exact: true }).click();
    const dialogTitle = page.getByRole("heading", { name: "Nueva cuenta de gestión" });
    await expect(dialogTitle).toBeVisible();

    // Completar el form. Los selects de tipo/destino son <select> nativos
    // poblados con los dominios presentes en el árbol.
    await page.getByLabel("Código").fill("9.9");
    await page.getByLabel("Nombre", { exact: true }).fill("Cuenta E2E");
    await page.getByLabel("Tipo").selectOption("income");
    await page.getByLabel("Destino").selectOption("operational_income_statement");

    // Crear → POST /api/management/accounts (MSW) → onSuccess cierra el dialog.
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await expect(dialogTitle).toBeHidden();
  });

  test("validación: crear sin código/nombre muestra errores y no cierra", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/estructura-gestion");
    await expect(page.getByText("Ingresos").first()).toBeVisible();

    await page.getByRole("button", { name: "Nueva cuenta", exact: true }).click();
    const dialogTitle = page.getByRole("heading", { name: "Nueva cuenta de gestión" });
    await expect(dialogTitle).toBeVisible();

    // Submit vacío → zod rechaza → el dialog NO se cierra y hay alerts.
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await expect(dialogTitle).toBeVisible();
    await expect(page.getByText("El código es requerido")).toBeVisible();
    await expect(page.getByText("El nombre es requerido")).toBeVisible();
  });
});
