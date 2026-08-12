import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — conciliar cobros FILA-POR-FILA desde el caveat de Caja (#851, flag `cajaMarkCollected` ON
   en el env de e2e; OFF en prod hasta validar el write). Con `cajaV3` ON, el "Saldo proyectado" es el
   MEDIDOR: cuando la caja está en riesgo y hay plata por cobrar vencida, el caveat lista los documentos
   y cada uno con identidad (`source_external_id`) trae "Ya lo cobré" → mark-collected (MSW). */

test.describe("Flujo: conciliar cobros fila-por-fila en Caja (#851)", () => {
  test("el caveat lista los cobros vencidos y 'Ya lo cobré' concilia el documento", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/proyeccion");

    // Medidor de caja (Caja v3): el fixture proyecta un piso bajo la mínima → "Caja ajustada".
    await expect(page.getByText(/Caja (holgada|ajustada|en riesgo)/)).toBeVisible();

    // Caveat honesto: la proyección NO cuenta lo por cobrar vencido. El "N documentos" es un toggle.
    const toggle = page.getByRole("button", { name: /documentos vencidos o sin fecha/ });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // La lista uno-por-uno: el mayor cobro del fixture.
    await expect(page.getByText("TD SYNNEX CHILE LIMITADA")).toBeVisible();

    // Los 3 cobros del fixture traen identidad (source_external_id) → 3 botones "Ya lo cobré".
    const botones = page.getByRole("button", { name: "Ya lo cobré" });
    await expect(botones).toHaveCount(3);

    // Conciliar el primero → mark-collected (MSW conciliados:1) → toast honesto.
    await botones.first().click();
    await expect(page.getByText(/Listo, lo saqué de por cobrar/)).toBeVisible();
  });
});
