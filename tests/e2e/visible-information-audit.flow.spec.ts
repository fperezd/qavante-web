import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { loginAs } from "./helpers";

const VIEWPORTS = [
  { name: "pc-1280", width: 1280, height: 800 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
] as const;

const ROUTES = [
  { id: "connections", path: "/conexiones" },
  { id: "activity", path: "/inicio/actividad" },
  { id: "inbox", path: "/bandeja" },
  { id: "foreign-purchases", path: "/caja/compras-extranjero" },
  { id: "bank", path: "/banco" },
  { id: "receivables", path: "/cobrar" },
  { id: "payables", path: "/pagar" },
  { id: "taxes", path: "/impuestos" },
  { id: "payroll", path: "/remuneraciones" },
  { id: "management", path: "/gestion" },
  { id: "budget", path: "/presupuesto" },
  { id: "financing", path: "/financiamiento" },
  { id: "simulation", path: "/simular" },
  { id: "companies", path: "/administracion/empresas" },
  { id: "account", path: "/mi-cuenta" },
  { id: "onboarding", path: "/bienvenida" },
] as const;

const TECHNICAL_COPY =
  /\b(?:backend|endpoint|scope|tenant|smoke|schema|trace|stack|uuid|sprint|motor|piloto)\b|ADR-\d+|fase\s+\d+|categor[ií]a can[oó]nica|financial impacts|read model|prototipo UX|datos ficticios/i;

async function prepareRoute(page: Page, routeId: (typeof ROUTES)[number]["id"]) {
  if (routeId === "activity") {
    await expect(page.getByText(/Proveedor Uno/).first()).toBeVisible();
    await expect(page.getByText(/del 10-03-2026 al 25-03-2026/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Deshacer:.*Proveedor Uno/i })).toBeVisible();
    return;
  }

  if (routeId === "inbox") {
    // OFF mantiene la cola V07 de producción (`secondaryAudit=false`): es una
    // decisión que requiere revisión, no la landing secundaria del Brief ON.
    await expect(page.getByText("Bandeja", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: /Conciliar/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Clasificar/i })).toBeVisible();
    return;
  }

  if (routeId === "bank") {
    await expect(page.getByText("Saldo contable según el banco").first()).toBeVisible();
    await expect(page.getByText("Cartola").first()).toBeVisible();
    return;
  }

  if (routeId === "management") {
    const hero = page.getByText("El negocio ganó este mes", { exact: true }).locator("..");
    await expect(hero.getByText("$3.900.000", { exact: true })).toBeVisible();
    return;
  }

  if (routeId !== "simulation") return;

  const suggestion = page.getByRole("button", { name: /nuevo gasto/i });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await page.getByRole("button", { name: "Evaluar supuesto" }).click();
  await expect(page.getByText("Puedes asumir el gasto, con una condición.")).toBeVisible();
}

async function captureEvidence(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.describe("Auditoría de información visible · anchos exigidos", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: rutas representativas sin desborde ni copy técnico`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(180_000);
      await loginAs(context, "owner");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of ROUTES) {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main")).toBeVisible();
        await prepareRoute(page, route.id);

        const bodyText = await page.locator("body").innerText();
        expect(bodyText, `${route.path} no debe exponer copy técnico`).not.toMatch(TECHNICAL_COPY);
        if (route.id === "financing" || route.id === "simulation") {
          expect(bodyText, `${route.path} no debe exponer el contrato técnico`).not.toMatch(
            /\bcontrato\b|\/api\//i,
          );
        }

        const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(
          documentWidth,
          `${route.path} no debe producir desplazamiento horizontal de página`,
        ).toBeLessThanOrEqual(viewportWidth + 1);

        await captureEvidence(page, testInfo, `${viewport.name}-${route.id}`);
      }
    });
  }
});
