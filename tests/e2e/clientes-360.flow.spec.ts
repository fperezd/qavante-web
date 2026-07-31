import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Clientes 360 (pedido de Fernando 2026-07-30). Analiza el comportamiento
   comercial de un cliente en el tiempo desde el RCV ventas (MSW sirve Cliente A/B). Se afirma la
   ESTRUCTURA (selector + bloques), no montos (dependen del fixture). Gated `operationalResult`. */

test.describe("Flujo: Clientes 360 (/gestion/clientes)", () => {
  test("muestra el selector y los bloques de análisis de la contraparte", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/clientes");

    await expect(page.getByRole("heading", { level: 1, name: "Clientes 360" })).toBeVisible();

    const main = page.locator("#main-content");
    // Selector buscable de cliente (default = el que más pesa).
    await expect(main.getByText("Busca un cliente por nombre o RUT")).toBeVisible();

    // Bloques del 360. Los títulos por rol heading ("Estacionalidad" también aparece en el
    // subtítulo de la página como substring); el de barras es un string completo y único.
    await expect(main.getByText("Ventas mes a mes (últimos 12 meses)")).toBeVisible();
    await expect(main.getByRole("heading", { name: "Estacionalidad" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Últimos documentos" })).toBeVisible();
    // Recuperación: mes en curso vs. mejor mes.
    await expect(
      main.getByRole("heading", { name: "A recuperar (mes en curso vs. su mejor mes)" }),
    ).toBeVisible();

    // Regresión: las barras deben tener ALTURA real (el % no resolvía sin altura definida en el
    // padre → gráfico vacío). Al menos una barra > 20px.
    const alturas = await main
      .locator('[data-testid="serie-barra"]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.max(0, ...alturas)).toBeGreaterThan(20);
    // Los "días de pago real" se declaran honestos como pendientes.
    await expect(main.getByText(/Días promedio .* en preparación/i)).toBeVisible();

    // Selector buscable: por defecto sale el que más pesa (Cliente A); cambiar a otro NO exige
    // borrar texto (el input arranca vacío) → escribir filtra y elegir cambia la contraparte.
    await expect(main.getByRole("heading", { name: "Cliente A SA" })).toBeVisible();
    const buscar = main.getByRole("combobox");
    await buscar.click();
    await buscar.fill("Cliente B");
    await expect(main.getByRole("option", { name: /Cliente B/ })).toBeVisible();
    await buscar.press("Enter"); // elige el primer resultado (teclado)
    await expect(main.getByRole("heading", { name: "Cliente B Ltda" })).toBeVisible();
  });
});
