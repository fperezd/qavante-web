import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — gestión de empresas en Administración → Empresas.
   Crear una empresa vive acá (no en el selector del header). Lista las empresas
   del usuario y abre el formulario de creación. MSW sirve /me/tenants. */

test.describe("Flujo: Empresas (/administracion/empresas)", () => {
  test("lista las empresas y abre el formulario de crear", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/empresas");

    await expect(page.getByRole("heading", { level: 1, name: "Empresas" })).toBeVisible();

    // El botón de crear vive acá (no en el header).
    const crear = page.getByRole("button", { name: "Crear empresa" });
    await expect(crear).toBeVisible();

    await crear.click();
    // Aparece el formulario de nueva empresa.
    await expect(page.getByText("Nueva empresa")).toBeVisible();
    await expect(page.getByLabel("Razón social")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear y entrar" })).toBeVisible();
  });

  test("el selector del header ya NO ofrece crear empresa", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    // Abrir el selector de empresa del header.
    await page.getByRole("button", { name: /Empresa activa:/ }).click();
    // Ya no debe existir la opción "Agregar empresa" en el menú.
    await expect(page.getByRole("menuitem", { name: "Agregar empresa" })).toHaveCount(0);
  });
});
