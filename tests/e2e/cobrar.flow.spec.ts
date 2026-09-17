import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Cobrar. Producción publica V04 antes de V2 (`cobrarV04="true"` en `wrangler.toml`, y el
   mismo flag en el entorno E2E): una pantalla con la antigüedad que publica el servidor, el
   vencido bruto y la cartera por cliente. Los tramos y los porcentajes vienen del contrato: la
   pantalla no los recalcula desde la tabla, y no afirma el hero RCV de una variante que estos
   flags no montan. */

test.describe("Flujo: Cobrar V04 de producción (/cobrar)", () => {
  test("tramos de antigüedad del servidor + vencido bruto + concentración", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    await expect(page.getByRole("heading", { level: 1, name: "Cobrar" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Antigüedad de saldos" })).toBeVisible();

    // Los cuatro tramos del contrato, cada uno con su parte del total.
    for (const tramo of ["Vigente", "1–30 días", "31–60 días", "+61 días"]) {
      await expect(page.getByText(tramo, { exact: true })).toBeVisible();
    }
    const antiguedad = page.getByRole("region", { name: "Antigüedad de saldos" });
    await expect(antiguedad).toContainText("Vencido");
    await expect(antiguedad).not.toContainText("bruto");
    await expect(antiguedad).toContainText("$7.900.000");
    await expect(page.getByText(/31,9% del total/)).toBeVisible();

    // La concentración se declara con su cobertura, sin prometer el cobro.
    await expect(page.getByText(/3 clientes concentran .* del vencido/)).toBeVisible();

    /* El hero de urgencia es de V2, que estos flags no montan. Gemelo positivo con la MISMA
       pantalla: el encabezado que V04 sí publica. */
    await expect(page.getByText("Cóbrale primero a")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Clientes con saldo" })).toBeVisible();
  });

  test("la lista de clientes publica antigüedad, saldo y la gestión registrada", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    const fila = page.getByRole("row", { name: /Constructora Andes SpA/ });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText("$9.800.000");
    // El "sin gestión registrada" es un hecho del registro, no un default tranquilizador.
    await expect(fila).toContainText("sin gestión registrada");
    // Los chips traen el conteo que publica el servidor.
    await expect(page.getByRole("radio", { name: "Prioridad · 3" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Vencido · 3" })).toBeVisible();
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

  test("certeza de la fecha: pill y nota del servidor por documento; lo estimado no es mora", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    /* Los tres valores del contrato en la misma cartera. La pill y la nota son server-owned
       (`due_date_certainty` + `due_date_note` de cada documento vencido). Control negativo: sin el
       render de la certeza, "Fecha estimada" no existe en el DOM y este test falla. */
    const comercial = page.getByRole("row", { name: /Comercial del Sur Ltda/ });
    await expect(comercial).toBeVisible();
    await expect(comercial.getByText("Fecha aproximada", { exact: true })).toBeVisible();
    await expect(
      comercial.getByText(
        /Factura 5680 · Fecha estimada a 30 días desde la emisión; no acredita un vencimiento pactado\./,
      ),
    ).toBeVisible();
    /* El documento estimado dice 40 días; el confirmado, 15. Los días de mora de la fila son los
       del confirmado: lo estimado se lista, pero no alimenta el "vencido" derivado. */
    await expect(comercial).toContainText("vencido $2.400.000 hace 15 días");
    await expect(comercial).not.toContainText("hace 40 días");

    const minera = page.getByRole("row", { name: /Minera Atacama SA/ });
    await expect(minera.getByText("Fecha por confirmar", { exact: true })).toBeVisible();
    await expect(minera.getByText("Factura 9020", { exact: true })).toBeVisible();
    await expect(minera).toContainText("hace 8 días");

    // Gemelo: el cliente con todo confirmado no lleva pill de certeza.
    const andes = page.getByRole("row", { name: /Constructora Andes SpA/ });
    await expect(andes.getByText(/Fecha aproximada|Fecha por confirmar|Certeza/)).toHaveCount(0);

    // El conteo de estimados es `estimated_due_date_count` del servidor, junto a Vencido · bruto.
    const antiguedad = page.getByRole("region", { name: "Antigüedad de saldos" });
    await expect(antiguedad).toContainText("1 documento con fecha estimada, fuera de la mora");
    await expect(antiguedad).toContainText("$7.900.000"); // el vencido del contrato no cambia
  });

  test("marcar gestionado actualiza explícitamente el registro del cliente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");

    const fila = page.getByRole("row", { name: /Constructora Andes SpA/ });
    await expect(fila).toContainText("sin gestión registrada");
    await fila.getByRole("button", { name: "Gestionado" }).first().click();
    await expect(fila.getByRole("button", { name: "Reabrir" }).first()).toBeVisible();
    await expect(fila).not.toContainText("sin gestión registrada");
  });
});
