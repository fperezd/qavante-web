import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Punto de equilibrio (pedido de Fernando 2026-07-29). Deriva
   fijo/variable del operational-result (MSW fixture del mes) y responde "¿cuánto
   necesito vender para no perder?". Gated `operationalResult` (ON en e2e). */

test.describe("Flujo: Punto de equilibrio (/gestion/punto-equilibrio)", () => {
  test("muestra el piso de venta, los tres números y la composición", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/punto-equilibrio");

    await expect(
      page.getByRole("heading", { level: 1, name: "Punto de equilibrio" }),
    ).toBeVisible();

    const main = page.locator("#main-content");
    // Hero: el piso de venta mensual.
    await expect(main.getByText(/Necesitas vender .* al mes para no perder/i)).toBeVisible();

    // Los tres números (labels de los tiles; "Vas en" exact para no chocar con el hero
    // "Vas en $18.500.000 — …", y "Punto de equilibrio" con .first() por el h1).
    await expect(main.getByText("Punto de equilibrio").first()).toBeVisible();
    await expect(main.getByText("Vas en", { exact: true })).toBeVisible();
    await expect(main.getByText("Margen de contribución")).toBeVisible();

    // Composición + la nota honesta de aproximación.
    await expect(main.getByText("Cómo se compone")).toBeVisible();
    await expect(main.getByText(/Costo fijo mensual/i)).toBeVisible();
    await expect(main.getByText(/tratamos el/i)).toBeVisible();
  });
});
