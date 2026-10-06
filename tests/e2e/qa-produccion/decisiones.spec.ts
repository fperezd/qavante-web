import { test, expect, esperarApi } from "./support/fixtures";
import {
  AUTORIZA_PROYECCION,
  SESSION,
  SIN_AUTORIZACION_DE_ESCRITURA,
  SIN_SESION,
} from "./support/env";

/* Decisiones (src/app/(app)/decisiones/page.tsx). Cambiar el horizonte (7/14/30/60/90 días) sólo
   recalcula la proyección (POST cash-projection-runs, la única escritura tolerada por la guardia);
   no hay botones de ejecutar en esta pantalla. */

const HORIZONTES = [7, 14, 30, 60, 90] as const;

test.describe("QA producción · Decisiones", () => {
  test.skip(!SESSION, SIN_SESION);

  test('B19 — si el cálculo falla, la pantalla dice qué cálculo falló, no "mantenimiento" ni "Calculando período" eterno', async ({
    page,
    evidencia,
  }) => {
    test.skip(!AUTORIZA_PROYECCION, SIN_AUTORIZACION_DE_ESCRITURA);
    const primera = esperarApi(page, /^\/api\/treasury\/cash-projection-runs$/, { metodo: "POST" });
    await page.goto("/decisiones");
    await expect(page.getByRole("group", { name: "Horizonte" })).toBeVisible();
    let respuesta = await primera;
    const estados: string[] = [];

    for (const dias of HORIZONTES) {
      if (dias !== 14) {
        const espera = esperarApi(page, /^\/api\/treasury\/cash-projection-runs$/, {
          metodo: "POST",
        });
        await page
          .getByRole("group", { name: "Horizonte" })
          .getByRole("button", { name: `${dias} días` })
          .click();
        respuesta = await espera;
      }
      const status = respuesta?.status() ?? 0;
      estados.push(`${dias} días → ${status || "sin solicitud"}`);
      if (status >= 200 && status < 400) continue;

      const main = page.locator("body");
      await expect
        .soft(main, `${dias} días: el error (${status}) se muestra como mantenimiento`)
        .not.toContainText(/mantenimiento/i);
      await expect
        .soft(
          main,
          `${dias} días: el período queda en "Calculando período" pese al error ${status}`,
        )
        .not.toContainText("Calculando período");
    }
    evidencia.nota(`Horizontes: ${estados.join(" · ")}`);
  });
});
