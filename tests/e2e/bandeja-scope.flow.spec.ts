import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Bandeja cambia las cuatro colas con la sociedad seleccionada", async ({ page, context }) => {
  await loginAs(context, "owner");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/treasury/work-inbox")) requests.push(request.url());
  });

  await page.goto("/bandeja");
  await expect(
    page.getByRole("combobox", { name: "Seleccionar sociedad de la Bandeja" }),
  ).toHaveValue("11111111-1111-4111-8111-111111111111");
  await expect(page.getByText("Cobro Alfa")).toBeVisible();
  await expect(page.getByText("Cobro Beta")).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "Seleccionar sociedad de la Bandeja" })
    .selectOption("22222222-2222-4222-8222-222222222222");
  await expect(page.getByText("Cobro Beta")).toBeVisible();
  await expect(page.getByText("Cobro Alfa")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Cobro Beta/ })).toHaveAttribute(
    "href",
    /legal_entity_id=22222222-2222-4222-8222-222222222222/,
  );
  expect(
    requests.some((url) => url.includes("legal_entity_id=11111111-1111-4111-8111-111111111111")),
  ).toBe(true);
  expect(
    requests.some((url) => url.includes("legal_entity_id=22222222-2222-4222-8222-222222222222")),
  ).toBe(true);
});
