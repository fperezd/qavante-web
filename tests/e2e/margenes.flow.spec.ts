import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Márgenes. Los tres márgenes del mes + el bloque "De cada $100
   que vendes, ¿dónde queda?" (barra costo de ventas + gastos + lo que queda),
   pedido de Fernando 2026-07-29. Contra MSW (operational-result del mes: rev
   $18,5M, resultado $3,9M ⇒ neto ≥ 0 ⇒ el bloque se muestra). Gated
   `operationalResult` (ON en e2e). */

test.describe("Flujo: Márgenes (/gestion/margenes)", () => {
  test("muestra los tres márgenes y el desglose de cada $100", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/margenes");

    await expect(page.getByRole("heading", { level: 1, name: "Márgenes" })).toBeVisible();

    const main = page.locator("#main-content");
    // exact: "Margen bruto" también aparece en el caption del sparkline ("… · últimos N meses");
    // "Costo de ventas" está en el tile Y en el desglose de $100 → .first().
    await expect(main.getByText("Margen bruto", { exact: true })).toBeVisible();
    await expect(main.getByText("Costo de ventas").first()).toBeVisible();
    await expect(main.getByText("Margen neto", { exact: true })).toBeVisible();

    // El bloque nuevo "de cada $100". "Te queda" exact: el subtítulo de la página dice
    // "¿Cuánto te queda de cada peso…" (substring), el label del segmento es exactamente "Te queda".
    await expect(main.getByText("De cada $100 que vendes, ¿dónde queda?")).toBeVisible();
    await expect(main.getByText("Te queda", { exact: true })).toBeVisible();

    // Tarjetas movibles (pedido de Fernando): "De cada $100" y el histórico del margen van lado a
    // lado y con control para reordenar (asa de arrastre + flechas). El asa aparece con hover, así
    // que verificamos que esté en el DOM (attached), no que sea visible sin interacción.
    await expect(main.getByRole("button", { name: /para reordenar/ }).first()).toBeAttached();
  });
});
