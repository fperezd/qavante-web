import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Administración → MCP (flag `mcp`, ON en e2e). Conectar la empresa a un asistente LLM:
   muestra la URL del server + la auth, y gestiona las API-keys (crear = se ve entera una vez, revocar).
   Contra MSW (api-keys stateful). */

test.describe("Flujo: Administración → MCP (/administracion/mcp)", () => {
  test("conecta, crea una API-key (se ve una vez) y revoca", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/mcp");

    await expect(
      page.getByRole("heading", { level: 1, name: "Conectar un asistente (MCP)" }),
    ).toBeVisible();

    // Cómo conectar: dirección del server + auth + el instructivo del backend (docs.pasos/clientes).
    await expect(page.getByText("https://mcp.qavante.com")).toBeVisible();
    await expect(page.getByText("X-Api-Key").first()).toBeVisible();
    await expect(page.getByText(/cómo va mi caja/i)).toBeVisible(); // un paso del instructivo
    await expect(page.getByText(/Llega en la fase 3/i)).toBeVisible(); // cliente OAuth (no soportado aún)

    // La key que ya existe (fixture).
    await expect(page.getByText("Asistente de finanzas")).toBeVisible();

    // Crear una nueva → la key entera se muestra UNA vez.
    await page.getByRole("button", { name: /Crear API-key/i }).click();
    await page.getByPlaceholder("Asistente de finanzas").fill("Mi ChatGPT");
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(page.getByText(/no se vuelve a mostrar/i)).toBeVisible();
    await expect(page.getByText(/qav_live_k2xy_FULLKEYSECRET/)).toBeVisible();
    await page.getByRole("button", { name: "Ya la guardé" }).click();

    // Revocar la key original → queda "revocada".
    await page.getByRole("button", { name: /Revocar Asistente de finanzas/ }).click();
    await expect(page.getByText("revocada")).toBeVisible();
  });
});
