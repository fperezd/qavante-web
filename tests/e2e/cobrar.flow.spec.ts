import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Cobrar / cuentas por cobrar (Sprint C4). Pantalla FE-first contra
   MSW, gated por `accountsReceivable` (ON en el env de e2e). Valida el resumen,
   la antigüedad de saldos, top deudores y documentos vencidos. */

test.describe("Flujo: Cobrar (/cobrar)", () => {
  test("muestra resumen, aging, top deudores y documentos vencidos", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByRole("heading", { level: 1, name: "Cobrar" })).toBeVisible();

    // Resumen (datos de MSW).
    await expect(page.getByText("Total por cobrar")).toBeVisible();
    await expect(page.getByText("% vencido")).toBeVisible();
    // Secciones principales.
    await expect(page.getByText("Antigüedad de saldos")).toBeVisible();
    await expect(page.getByText("Top deudores")).toBeVisible();
    await expect(page.getByText("Documentos vencidos")).toBeVisible();
    // Un deudor del fixture.
    await expect(page.getByText("Constructora Andes SpA").first()).toBeVisible();
  });

  test("cada deudor es expandible → drill-down a sus facturas", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    const debtor = page.getByRole("button", { name: /Constructora Andes SpA/ });
    await expect(debtor).toBeVisible();
    await expect(debtor).toHaveAttribute("aria-expanded", "false");

    // Clic → expande (acordeón) y muestra el panel de facturas del cliente.
    await debtor.click();
    await expect(debtor).toHaveAttribute("aria-expanded", "true");
    // El panel aparece (facturas reales o el estado honesto sin/pendiente).
    await expect(
      page.getByText(/Cargando facturas|Sin facturas de este cliente|mora por factura/i).first(),
    ).toBeVisible();
  });
});
