import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — gestión de empresas en Administración → Empresas.
   Crear una empresa vive acá (no en el selector del header). Lista las empresas
   del usuario y abre el formulario de creación. MSW sirve /me/tenants. */

test.describe("Flujo: Empresas (/administracion/empresas)", () => {
  test("agrega empresa: el RUT autocompleta la razón social desde el SII", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/empresas");

    await expect(page.getByRole("heading", { level: 1, name: "Empresas" })).toBeVisible();

    // El botón de agregar vive acá (no en el header).
    const agregar = page.getByRole("button", { name: "Agregar empresa" }).first();
    await expect(agregar).toBeVisible();
    await agregar.click();

    // RUT obligatorio → al ingresarlo, trae la razón social del SII.
    const rut = page.getByLabel("RUT de la empresa");
    await rut.fill("76.123.456-0");
    await rut.blur();

    await expect(page.getByText("Datos traídos del SII")).toBeVisible();
    await expect(page.getByLabel("Razón social")).toHaveValue("EMPRESA DEMO SPA");
    // Campos nuevos presentes.
    await expect(page.getByLabel(/Nombre comercial/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar empresa" }).last()).toBeVisible();
  });

  test("editar la empresa activa: abre el form y guarda", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/empresas");

    // "Editar" vive en la empresa activa (En uso).
    const editar = page.getByRole("button", { name: /Editar / });
    await expect(editar).toBeVisible();
    await editar.click();

    // Aparece el form de edición pre-poblado.
    const legalName = page.locator("#ec-legal-name");
    await expect(legalName).toBeVisible();
    await legalName.fill("Tooxs Digital SpA (editado)");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Empresa actualizada")).toBeVisible();
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
