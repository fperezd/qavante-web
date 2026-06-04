import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Asistente Qavante (Sprint C9, Anexo G). Chat construido FE-first
   contra MSW (endpoint backend aún no existe), gated por `assistant` (ON en el
   env de e2e). Valida abrir el drawer, enviar una pregunta y renderizar la
   respuesta — incluida la defensa anti-leak de ADR-0004 (NO se muestra
   `reasoning` ni la firma de tools). */

test.describe("Flujo: Asistente Qavante", () => {
  test("abre el drawer, pregunta y muestra respuesta sin leaks", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    // Abrir el drawer desde el botón flotante.
    await page.getByRole("button", { name: "Preguntar a Qavante" }).click();
    const dialog = page.getByRole("dialog", { name: "Asistente Qavante" });
    await expect(dialog).toBeVisible();

    // Enviar una sugerencia.
    await dialog.getByRole("button", { name: "¿Cómo está mi caja este mes?" }).click();

    // Respuesta (content de MSW) + chips de tools + link de source.
    await expect(dialog.getByText(/caja proyectada para los próximos 14 días/i)).toBeVisible();
    await expect(dialog.getByText(/Consultando/i).first()).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Caja proyectada/i })).toBeVisible();

    // ADR-0004: el `reasoning` del backend NO debe aparecer nunca en el cliente.
    await expect(dialog.getByText(/internal trace/i)).toHaveCount(0);
    await expect(dialog.getByText(/reasoning/i)).toHaveCount(0);
  });
});
