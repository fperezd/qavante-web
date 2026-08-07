import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Ciclo de caja (pedido de Fernando 2026-07-29). La vista
   consume /api/treasury/cash-cycle (MSW: cobra 48d / paga 30d ⇒ 18 días
   atrapados) y traduce DSO/DPO/CCC a lenguaje de dueño. Gated `operationalResult`
   (ON en e2e, espeja prod). */

test.describe("Flujo: Ciclo de caja (/gestion/ciclo-de-caja)", () => {
  test("muestra el veredicto de plata atrapada + los tres números + saldos vivos", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/ciclo-de-caja");

    await expect(page.getByRole("heading", { level: 1, name: "Ciclo de caja" })).toBeVisible();

    // Veredicto: CCC = 18 > 0 ⇒ plata atrapada (scopeado a #main-content por si el
    // texto "Ciclo de caja" del sidebar colisiona).
    const main = page.locator("#main-content");
    await expect(main.getByText(/plata queda atrapada 18 días/i)).toBeVisible();

    // Los tres números (DSO/DPO/CCC).
    await expect(main.getByText("Cobras en")).toBeVisible();
    await expect(main.getByText("48 días").first()).toBeVisible();
    await expect(main.getByText("Pagas en")).toBeVisible();
    await expect(main.getByText("30 días").first()).toBeVisible();
    await expect(main.getByText("Plata atrapada")).toBeVisible();

    // Saldos vivos por cobrar / por pagar.
    await expect(main.getByText("Por cobrar (vivo)")).toBeVisible();
    await expect(main.getByText("Por pagar (vivo)")).toBeVisible();

    // La ventana del cálculo (3 meses cerrados).
    await expect(main.getByText(/3 meses cerrados/i)).toBeVisible();

    // Comportamiento de pago (gated `comportamientoPago`, ON en e2e): el desfase real de cobro desde
    // collection-projection (MSW: behavior_shift_days=12, 18 de 25 con historial).
    await expect(main.getByText(/te pagan 12 días después del vencimiento/i)).toBeVisible();
    await expect(main.getByText(/18 de 25 facturas con historial/i)).toBeVisible();
  });
});
