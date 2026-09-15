import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Producción publica V04 antes de V2 (`cobrarV04=true` en wrangler.toml y en el entorno E2E).
   Esta suite fija la cartera canónica de accounts-receivable, sus filtros y el registro explícito
   de gestión; no afirma el hero RCV de una variante que no se monta con esos flags. */

test.describe("Flujo: Cobrar V04 de producción (/cobrar)", () => {
  test("publica antigüedad, vencido bruto y la cartera por cliente", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByRole("heading", { level: 1, name: "Cobrar" })).toBeVisible();
    const antiguedad = page.getByRole("region", { name: "Antigüedad de saldos" });
    await expect(antiguedad).toContainText("Vencido · bruto");
    await expect(antiguedad).toContainText("$7.900.000");
    await expect(page.getByRole("heading", { name: "Clientes con saldo" })).toBeVisible();
    await expect(page.getByText("Constructora Andes SpA")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Prioridad · 3" })).toBeChecked();
    await expect(page.getByText("Cóbrale primero a")).toHaveCount(0);
  });

  test("filtra la cartera por vencidos sin inventar una prioridad local distinta", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    const vencido = page.getByRole("radio", { name: "Vencido · 3" });
    await vencido.check();
    await expect(vencido).toBeChecked();
    await expect(page.getByText("Constructora Andes SpA")).toBeVisible();
    await expect(page.getByText("vencido $3.200.000 hace 23 días")).toBeVisible();
  });

  test("marcar gestionado actualiza explícitamente el registro del cliente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    const gestionar = page.getByRole("button", { name: "Gestionado" }).first();
    await expect(gestionar).toBeVisible();
    await gestionar.click();
    await expect(page.getByRole("button", { name: "Reabrir" }).first()).toBeVisible();
  });
});
