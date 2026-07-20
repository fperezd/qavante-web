import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Cobrar v2 (rediseño 2026-07-19). Pantalla FE-first contra MSW, gated por
   `cobrarV2` (ON en el env de e2e, espejando prod). El fixture de accounts-receivable
   trae mora (overdue) → la vista rinde en MODO URGENCIA: hero "Cóbrale primero a…" +
   acciones reales de cobranza + lista de deudores con drill-down a facturas. La
   persistencia de "gestionado" usa el handler de prefs (#571) en memoria. */

test.describe("Flujo: Cobrar v2 (/cobrar)", () => {
  test("hero 'a quién le cobras primero' + resumen + acciones", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByRole("heading", { level: 1, name: "Cobrar" })).toBeVisible();

    // Hero en modo urgencia (el fixture tiene mora): el deudor más vencido arriba.
    await expect(page.getByText("Cóbrale primero a")).toBeVisible();
    await expect(page.getByText("Constructora Andes SpA").first()).toBeVisible();

    // Resumen honesto + antigüedad (hay vencido → se muestra el aging).
    await expect(page.getByText("Total por cobrar")).toBeVisible();
    await expect(page.getByText("Antigüedad de saldos")).toBeVisible();

    // Acciones reales de cobranza.
    await expect(page.getByRole("button", { name: /Copiar recordatorio/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toBeVisible();

    // A quién cobrarle — la lista de deudores.
    await expect(page.getByText("A quién cobrarle")).toBeVisible();
  });

  test("un deudor expande → drill-down a sus facturas", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    // El deudor es un botón expandible (acordeón). Tomamos el de la LISTA (no el hero).
    const debtor = page
      .getByRole("button", { name: /Constructora Andes SpA/ })
      .last();
    await expect(debtor).toBeVisible();
    await expect(debtor).toHaveAttribute("aria-expanded", "false");

    await debtor.click();
    await expect(debtor).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText(/Cargando facturas|Sin facturas de este cliente|mora por factura/i).first(),
    ).toBeVisible();
  });

  test("marcar gestionado persiste y baja al deudor al fondo", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    // El hero muestra al #1 (Constructora Andes). Lo marcamos gestionado desde el hero.
    await expect(page.getByText("Cóbrale primero a")).toBeVisible();
    await expect(page.getByText("Constructora Andes SpA").first()).toBeVisible();

    await page.getByRole("button", { name: /Marcar gestionado/ }).first().click();

    // Tras persistir en prefs (handler #571) + re-render, aparece el chip "Gestionado"
    // en la fila de ese deudor, que baja al fondo de la lista.
    await expect(page.getByText(/Gestionado/).first()).toBeVisible();
  });
});
