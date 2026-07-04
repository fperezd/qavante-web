import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — command palette (⌘K / Ctrl+K). Nivel dios: navegar la app entera desde
   el teclado. Se abre con el atajo y con la barra de búsqueda del header; filtra
   y navega con Enter. Verifica el loop real (no solo render). */

test.describe("Flujo: command palette (⌘K)", () => {
  test("Ctrl+K abre, filtra y navega con Enter", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    // El atajo global se registra en un efecto del shell → esperar a que el
    // header (mismo árbol cliente) esté montado/hidratado antes de disparar ⌘K.
    await expect(page.getByRole("button", { name: /Buscar y navegar/ })).toBeVisible();

    // Abrir con el atajo global.
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Buscar pantalla o acción…");
    await expect(input).toBeVisible();

    // Filtrar y abrir el Libro de Compras.
    await input.fill("compras");
    await expect(page.getByRole("option", { name: /Libro de Compras/ })).toBeVisible();
    await input.press("Enter");

    await expect(page).toHaveURL(/\/pagar\/facturas-recibidas/);
  });

  test("la barra de búsqueda del header también lo abre; Esc lo cierra", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    await page.getByRole("button", { name: /Buscar y navegar/ }).click();
    const input = page.getByPlaceholder("Buscar pantalla o acción…");
    await expect(input).toBeVisible();

    await input.press("Escape");
    await expect(input).toBeHidden();
  });
});
