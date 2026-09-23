import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Bandeja cambia las cuatro colas con la Empresa activa", async ({ page, context }) => {
  await loginAs(context, "owner");
  const requests: { url: string; companyId: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/treasury/work-inbox")) {
      requests.push({ url: request.url(), companyId: request.headers()["x-qavante-company-id"] });
    }
  });

  await page.goto("/bandeja");
  await expect(
    page.getByRole("button", { name: /Empresa activa: Tooxs Digital SpA/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Cobro Alfa"), JSON.stringify(requests)).toBeVisible();
  await expect(page.getByText("Cobro Beta")).toHaveCount(0);

  await page.getByRole("button", { name: /Empresa activa: Tooxs Digital SpA/ }).click();
  await page.getByRole("menuitem", { name: "Tooxs Operaciones SpA" }).click();
  await expect(page.getByText("Cobro Beta"), JSON.stringify(requests)).toBeVisible();
  await expect(page.getByText("Cobro Alfa")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Cobro Beta/ })).toHaveAttribute(
    "href",
    /\/documentos\/receivable\/22222222-2222-4222-8222-222222222223$/,
  );
  expect(requests.some((request) => request.companyId === "e_tooxs")).toBe(true);
  expect(requests.some((request) => request.companyId === "e_demo")).toBe(true);
  expect(
    requests.every((request) => request.url.includes(`legal_entity_id=${request.companyId}`)),
  ).toBe(true);
});
