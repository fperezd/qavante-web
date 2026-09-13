import { expect, test } from "@playwright/test";

test("Financiamiento sin sesión conserva la frontera de autenticación", async ({ request }) => {
  const response = await request.get("/financiamiento", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
  expect(response.headers().location).toContain("redirect=%2Ffinanciamiento");
});

test("Financiamiento autenticado no expone un 500 del Worker", async ({ page }) => {
  test.skip(!process.env.SMOKE_RUT || !process.env.SMOKE_PASSWORD, "Requiere cuenta smoke");
  const apiBase = process.env.SMOKE_API_URL ?? "https://api.qavante.com";
  const login = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { rut: process.env.SMOKE_RUT, password: process.env.SMOKE_PASSWORD },
  });
  expect(login.status()).toBe(200);

  const response = await page.goto("/financiamiento", { waitUntil: "domcontentloaded" });
  expect(response?.status()).not.toBe(500);
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
  await expect(page.locator("body")).toContainText(
    /Consultando deuda, costo y capacidad|No pudimos confirmar|La lectura de deuda no respondió|¿Te conviene financiarte\?/,
    { timeout: 30_000 },
  );
});
