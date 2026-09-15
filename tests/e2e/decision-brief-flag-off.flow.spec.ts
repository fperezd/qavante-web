import { expect, test, type Request } from "@playwright/test";
import { loginAs } from "./helpers";

/* Corre con playwright.config.ts, cuyo build separado fija el flag en false.
 * Verifica el kill switch completo: el Brief no se monta en ninguna ruta Y cada
 * superficie conserva su recorrido existente.
 *
 * Los `expected` de abajo son los gemelos positivos de las ausencias que afirma
 * `decision-brief-consistency.flow.spec.ts` con el flag encendido: se escriben
 * con la MISMA cadena a propósito, para que ninguno de los dos lados pase por
 * bueno sin casar contra el DOM real. */
const SURFACES = [
  {
    path: "/inicio",
    /* Sin Brief, el resumen publica además su lista local de prioridades. */
    visible: ["Requiere atención"],
    testIds: ["inicio-resumen"],
  },
  {
    /* El entorno E2E enciende `cajaV02` como producción: la landing es V02, con su pregunta
       propia y la auditoría de movimientos debajo. */
    path: "/caja",
    visible: ["¿Me alcanza la caja?", "Calidad y auditoría de movimientos"],
    testIds: [],
  },
  {
    path: "/bandeja",
    visible: ["Bandeja · decisiones que requieren tu revisión"],
    testIds: [],
  },
  {
    path: "/pagar",
    /* Sin Brief, V05 sí rankea por urgencia y no anuncia el orden de la fuente. */
    visible: [
      "¿A quién le pago, y qué es crítico?",
      "Impuestos y sueldos jamás entran en postergaciones automáticas.",
    ],
    absent: ["Los pagos se muestran en el orden publicado por la fuente."],
    testIds: [],
  },
  {
    path: "/cobrar",
    visible: ["¿Quién me debe?"],
    testIds: [],
  },
] as const;

/* Gemelos positivos de las ausencias que afirma el spec ON: con el Brief apagado,
   Hoy SÍ pide su plan local y su evaluación de liquidez. Sin esto, aquellos
   `toEqual([])` pasarían igual aunque los endpoints hubieran dejado de existir.
   Se afirma que se PIDEN, no lo que responden: MSW no sirve `decisions`. */
const DECISION_PRODUCER_PREFIXES = [
  "/api/treasury/decision-plans",
  "/api/treasury/decisions",
] as const;

test("Decision Brief apagado no se monta en las cinco superficies", async ({ page, context }) => {
  test.setTimeout(180_000);
  await loginAs(context, "owner");

  const decisionProducerRequests: string[] = [];
  const trackDecisionProducer = (request: Request) => {
    const path = new URL(request.url()).pathname;
    if (
      DECISION_PRODUCER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ) {
      decisionProducerRequests.push(path);
    }
  };
  page.on("request", trackDecisionProducer);

  for (const surface of SURFACES) {
    await page.goto(surface.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-decision-brief-surface]")).toHaveCount(0);
    await expect(page.getByTestId("cash-decision-brief")).toHaveCount(0);

    // Assert positivo: la ruta sigue sirviendo su vista existente, no una pantalla vacía.
    for (const testId of surface.testIds) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    for (const text of surface.visible) {
      await expect(page.getByText(text).first()).toBeVisible();
    }
    for (const text of ("absent" in surface ? surface.absent : []) as readonly string[]) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
  }

  for (const prefix of DECISION_PRODUCER_PREFIXES) {
    await expect
      .poll(
        () =>
          decisionProducerRequests.filter(
            (path) => path === prefix || path.startsWith(`${prefix}/`),
          ).length,
        { message: `sin el Brief, Hoy debe seguir pidiendo ${prefix}` },
      )
      .toBeGreaterThan(0);
  }
  page.off("request", trackDecisionProducer);
});
