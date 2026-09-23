import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Administración de Empresas legales. El Tenant no se selecciona en esta pantalla. */

test.describe("Flujo: Empresas (/administracion/empresas)", () => {
  test("agrega una Empresa y la deja activa en el header", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/empresas");

    await expect(page.getByRole("heading", { level: 1, name: "Empresas" })).toBeVisible();

    const agregar = page.getByRole("button", { name: "Agregar empresa" }).first();
    await expect(agregar).toBeVisible();
    await agregar.click();

    await page.getByLabel("Razón social").fill("Nueva Empresa SpA");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText("Empresa creada")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Empresa activa: Nueva Empresa SpA/ }),
    ).toBeVisible();
  });

  test("editar la empresa activa: abre el form y guarda", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/empresas");

    const editar = page.getByRole("button", { name: "Editar Tooxs Digital SpA" });
    await expect(editar).toBeVisible();
    await editar.click();

    const legalName = page.getByLabel("Razón social");
    await expect(legalName).toBeVisible();
    await legalName.fill("Tooxs Digital SpA (editado)");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page.getByText("Empresa actualizada")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Empresa activa: Tooxs Digital SpA \(editado\)/ }),
    ).toBeVisible();
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
