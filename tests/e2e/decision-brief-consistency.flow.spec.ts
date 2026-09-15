import { expect, test, type Request } from "@playwright/test";
import {
  DECISION_BRIEF_E2E_CONTEXT_HASH,
  DECISION_BRIEF_E2E_CTA_HREFS,
  DECISION_BRIEF_E2E_DECISION_ID,
} from "../../src/test/msw/decision-brief-fixture";
import { loginAs } from "./helpers";

/* El mismo envelope se monta en todas las superficies. Este flujo no recalcula
 * ninguna cifra: comprueba que la identidad, el contexto y el CTA llegan igual
 * desde el servidor, incluido el query string que permite conservar el corte.
 *
 * Con el flag encendido la pantalla NO se vacía: el Brief va primero y debajo
 * queda la vista existente en modo evidencia (`suppressRecommendations`, o
 * `secondaryAudit` en Bandeja), que conserva los documentos en el orden
 * publicado por la fuente y deja de emitir su propio ranking. Cada ausencia que
 * se afirma acá tiene su gemelo presente en `decision-brief-flag-off.flow.spec.ts`
 * con la MISMA cadena, para que un assert negativo no pase por bueno sin casar. */
const DECISION_ID = DECISION_BRIEF_E2E_DECISION_ID;
const CONTEXT_HASH = DECISION_BRIEF_E2E_CONTEXT_HASH;

/* Sólo endpoints PRODUCTORES DE DECISIÓN local. Las fuentes de EVIDENCIA quedan
   fuera a propósito: con el Brief arriba las vistas conservan sus documentos y
   por lo tanto siguen leyendo sus propias fuentes, que es el comportamiento pedido.

   `/api/treasury/decisions` entra acá, y la versión anterior de este comentario
   decía lo contrario: afirmaba que alimentaba paneles F1/F9 "conservados con el
   Brief encendido". Es falso. Esos paneles (`LiquidityEvaluationPanel`,
   `CashGapProposalPanel`, `CollectionEvaluationPanel`, `DecisionReadPanel`) viven
   dentro del bloque `showDecision` de `inicio-resumen-view.tsx`, que la supresión
   fuerza a `false`. La lectura persistía sólo porque `useLatestLiquidityEvaluation`
   no estaba gateado, el mismo defecto que ya se había corregido para los planes.

   `/api/treasury/liquidity-evaluations` sigue fuera, y eso NO es cobertura: MSW no
   sirve `decisions`, así que la cadena se corta antes y afirmar su ausencia pasaría
   por una razón que no es la que se quiere medir.

   Cada ausencia de acá tiene gemelo positivo en `decision-brief-flag-off.flow.spec.ts`:
   con el flag apagado /inicio SÍ pide los dos prefijos. Sin ese gemelo, este
   `toEqual([])` pasaría igual si los endpoints no existieran. */
const DECISION_PRODUCER_PREFIXES = [
  "/api/treasury/decision-plans",
  "/api/treasury/decisions",
] as const;

function isDecisionProducerRequest(path: string) {
  return DECISION_PRODUCER_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

const SURFACES = [
  { name: "inicio", path: "/inicio" },
  { name: "caja", path: "/caja" },
  { name: "bandeja", path: "/bandeja" },
  { name: "pagar", path: "/pagar" },
  { name: "cobrar", path: "/cobrar" },
] as const;

const VIEWPORTS = [
  { name: "móvil 360", width: 360, height: 800 },
  { name: "tablet 768", width: 768, height: 900 },
  { name: "escritorio 1440", width: 1440, height: 900 },
] as const;

test.describe("Decision Brief canónico en las cinco superficies", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: conserva identidad, CTA y ancho`, async ({ page, context }) => {
      test.setTimeout(180_000);
      await loginAs(context, "owner");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const surface of SURFACES) {
        const decisionProducerRequests: string[] = [];
        const trackDecisionProducer = (request: Request) => {
          const path = new URL(request.url()).pathname;
          if (isDecisionProducerRequest(path)) decisionProducerRequests.push(path);
        };
        page.on("request", trackDecisionProducer);
        await page.goto(surface.path, { waitUntil: "domcontentloaded" });

        const slot = page.locator(`[data-decision-brief-surface="${surface.name}"]`);
        const brief = slot.getByTestId("cash-decision-brief");
        await expect(slot).toHaveCount(1);
        await expect(brief).toBeVisible();
        await expect(brief).toHaveAttribute("data-decision-id", DECISION_ID);
        await expect(brief).toHaveAttribute("data-context-hash", CONTEXT_HASH);
        await expect(
          brief.getByText("Tu caja no alcanza para cubrir los próximos pagos"),
        ).toBeVisible();
        /* La fixture publica "52418151.00" y "-52418151.362000000000", los dos
           formatos que trae producción. En pesos se muestran al peso: estos dos
           positivos y su gemelo negativo miden justamente eso. */
        await expect(brief.getByText("$52.418.151", { exact: true })).toBeVisible();
        await expect(brief.getByText("−$52.418.151", { exact: true })).toBeVisible();
        await expect(brief.getByText("$52.418.151,00")).toHaveCount(0);
        await expect(brief.getByText("52.418.151,362000000000")).toHaveCount(0);
        await expect(brief.getByText("52.418.151,36")).toHaveCount(0);
        await expect(brief.getByText("Registros en otra moneda: 2")).toBeVisible();

        /* No se reconstruyen con pathname/router: llegan literales, con sólo los dos
           parámetros de identidad publicados por el servidor. */
        await expect(brief.getByRole("link", { name: "Revisar pagos" })).toHaveAttribute(
          "href",
          DECISION_BRIEF_E2E_CTA_HREFS.reviewPayments,
        );
        await expect(brief.getByRole("link", { name: "Ver proyección" })).toHaveAttribute(
          "href",
          DECISION_BRIEF_E2E_CTA_HREFS.viewProjection,
        );
        await expect(brief.getByRole("link", { name: "Abrir auditoría" })).toHaveAttribute(
          "href",
          DECISION_BRIEF_E2E_CTA_HREFS.reviewAudit,
        );

        if (surface.name === "inicio") {
          // El resumen sigue montado como evidencia; su lista local de prioridades no.
          await expect(page.getByTestId("inicio-resumen")).toBeVisible();
          await expect(page.getByRole("heading", { name: "Requiere atención" })).toHaveCount(0);
        }

        if (surface.name === "caja") {
          // La auditoría de movimientos sigue accesible debajo del envelope.
          await expect(page.getByText("Calidad y auditoría de movimientos")).toBeVisible();
        }

        if (surface.name === "bandeja") {
          // La cola sigue accesible, rotulada como auditoría y no como decisión pendiente.
          await expect(page.getByText("Bandeja · auditoría de movimientos")).toBeVisible();
          await expect(
            page.getByText("Bandeja · decisiones que requieren tu revisión"),
          ).toHaveCount(0);
        }

        if (surface.name === "pagar") {
          // V05 conserva los documentos como evidencia, en el orden de la fuente, y no
          // fabrica una segunda decisión de postergabilidad.
          await expect(
            page.getByText("Los pagos se muestran en el orden publicado por la fuente."),
          ).toBeVisible();
          await expect(page.getByText("La decisión de qué postergar vive en Hoy")).toHaveCount(0);
          await expect(page.getByRole("columnheader", { name: "Tipo" })).toHaveCount(0);
          await expect(page.getByRole("link", { name: "Ver facturas" })).toBeVisible();
        }

        if (surface.name === "cobrar") {
          // V04 conserva la cartera recibida; no publica el filtro/ranking local de prioridad.
          await expect(page.getByRole("radio", { name: /Todos/ })).toBeVisible();
          await expect(page.getByText("Prioridad ·")).toHaveCount(0);
          await expect(page.getByRole("link", { name: "Ver facturas" })).toBeVisible();
          await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();
        }

        expect(
          decisionProducerRequests,
          `${surface.path} no debe pedir un plan local cuando el Brief decide`,
        ).toEqual([]);
        page.off("request", trackDecisionProducer);

        const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(
          documentWidth,
          `${surface.path} no debe desbordar a ${viewport.width}px`,
        ).toBeLessThanOrEqual(viewportWidth + 1);
      }
    });
  }
});
