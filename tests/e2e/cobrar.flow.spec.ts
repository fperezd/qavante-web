import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Cobrar v2 (/cobrar), UNIFICADO sobre RCV (2026-07-20). La cobranza deriva del
   RCV Ventas del año (misma base que Clientes): net de NC, con conciliado descontado y el
   vencimiento DERIVADO del término → hero en modo urgencia. accounts-receivable queda como
   respaldo si el RCV no cargó. Datos de MSW (rcv/ventas: "Cliente A SA", "Cliente B Ltda"). */

test.describe("Flujo: Cobrar v2 unificado (/cobrar)", () => {
  test("hero 'a quién le cobras primero' (vencido derivado) + resumen + acciones", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByRole("heading", { level: 1, name: "Cobrar" })).toBeVisible();
    // Con el vencido derivado del RCV, el hero va en modo urgencia.
    await expect(page.getByText("Cóbrale primero a")).toBeVisible();
    await expect(page.getByText("Cliente A SA").first()).toBeVisible();
    await expect(page.getByText("Total por cobrar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Copiar recordatorio/ }).first()).toBeVisible();
    await expect(page.getByText("A quién cobrarle")).toBeVisible();
  });

  test("un deudor expande → drill-down a sus documentos (folio/emisión/vencimiento/días)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    // Tomamos el deudor de la LISTA (botón expandible), no el hero.
    const debtor = page.getByRole("button", { name: /Cliente A SA/ }).last();
    await expect(debtor).toBeVisible();
    await debtor.click();
    await expect(debtor).toHaveAttribute("aria-expanded", "true");
    // El panel expandido lista los documentos del maestro con su vencimiento DERIVADO y días de mora.
    await expect(page.getByRole("columnheader", { name: "Vence" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Días" }).first()).toBeVisible();
  });

  test("marcar gestionado persiste y aparece el chip", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByText("Cóbrale primero a")).toBeVisible();
    await page.getByRole("button", { name: /Marcar gestionado/ }).first().click();
    await expect(page.getByText(/Gestionado/).first()).toBeVisible();
  });
});
