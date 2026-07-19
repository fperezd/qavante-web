import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Smoke — cada pantalla de Administración + Mi cuenta + Impuestos renderiza su vista real
   (flags ON en el env de e2e, espejando prod) sin caerse. Cubre las rutas que no tenían e2e.
   Si la vista (client) tira un error no manejado, el error boundary del segmento reemplaza la
   página entera y el <h1> no aparece → el assert lo caza. */

const SCREENS: ReadonlyArray<readonly [string, string]> = [
  ["/administracion", "Administración"],
  ["/administracion/monedas", "Monedas"],
  ["/administracion/plantillas", "Plantillas por rubro"],
  ["/administracion/vistas-gestion", "Vistas de gestión"],
  ["/administracion/reglas-clasificacion", "Reglas de clasificación"],
  ["/mi-cuenta", "Mi cuenta"],
  ["/pagar/impuestos", "Impuestos"],
];

test.describe("Smoke: Administración / Mi cuenta / Impuestos", () => {
  for (const [path, header] of SCREENS) {
    test(`${path} renderiza su vista`, async ({ page, context }) => {
      await loginAs(context, "owner");
      await page.goto(path);
      await expect(page.getByRole("heading", { name: new RegExp(header), level: 1 })).toBeVisible();
    });
  }
});
