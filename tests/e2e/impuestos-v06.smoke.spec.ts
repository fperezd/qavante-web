import { test, expect } from "@playwright/test";

test("V06 sin sesión conserva la frontera de autenticación", async ({ request }) => {
  const response = await request.get("/impuestos", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login-correo");
  expect(response.headers().location).toContain("redirect=%2Fimpuestos");
});

test("V06 autenticada muestra calendario, Ley 9 y limitación bancaria", async ({ page }) => {
  test.skip(!process.env.SMOKE_RUT || !process.env.SMOKE_PASSWORD, "Requiere cuenta smoke");
  const apiBase = process.env.SMOKE_API_URL ?? "https://api.qavante.com";
  const login = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { rut: process.env.SMOKE_RUT, password: process.env.SMOKE_PASSWORD },
  });
  expect(login.status()).toBe(200);
  await page.goto("/impuestos", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Impuestos", exact: true })).toBeVisible();
  await expect(page.getByText("Calendario tributario", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Las obligaciones tributarias nunca se postergan desde Qavante.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/pago son estados distintos/i)).toBeVisible();
  await expect(page.getByText(/movimiento bancario específico/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /postergar/i })).toHaveCount(0);
  await expect(
    page.getByText("Esta pantalla todavía no está disponible", { exact: true }),
  ).toHaveCount(0);
});
