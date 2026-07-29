import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Pulso detalle (Sprint C6/C7). Pantalla construida FE-first contra MSW
   (el endpoint backend aún no existe), gated por `pulsoDetail` (ON en el env de
   e2e). Valida render del score + ejes + drivers + tendencia. */

test.describe("Flujo: Pulso detalle (/gestion/pulso)", () => {
  test("muestra score, ejes, drivers y tendencia", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/pulso");

    await expect(page.getByRole("heading", { level: 1, name: "Pulso Empresa" })).toBeVisible();

    // Score destacado + headline rule-based (datos de MSW).
    await expect(page.getByText("Pulso del negocio")).toBeVisible();
    await expect(page.getByText(/la cobranza más lenta lo frena/i)).toBeVisible();

    // Ejes que componen el índice.
    await expect(page.getByText("Qué compone tu Pulso")).toBeVisible();
    await expect(page.getByText("Liquidez")).toBeVisible();

    // Drivers (+/-).
    await expect(page.getByText("Lo que ayuda")).toBeVisible();
    await expect(page.getByText("Lo que pesa")).toBeVisible();
    await expect(page.getByText("Cobranza lenta")).toBeVisible();

    // Tendencia (scopeado al contenido: el sidebar ahora tiene un link "Tendencia"
    // —sub-ítem de Gestión— que también matchea el texto).
    await expect(page.locator("#main-content").getByText("Tendencia")).toBeVisible();
  });
});
