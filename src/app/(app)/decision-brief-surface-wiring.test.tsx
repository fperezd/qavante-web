import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* #285 pide que, con el Brief encendido, las cinco superficies conserven su
 * evidencia y dejen de publicar un ranking propio. Esa mecánica ya vive en las
 * vistas (`suppressRecommendations`, y `secondaryAudit` en Bandeja); lo que este
 * test fija es el cableado de las páginas, que es donde se perdió antes: el
 * Brief va PRIMERO y la vista existente se monta debajo en modo evidencia.
 *
 * Los dobles echan sus props al markup a propósito: así el assert mide el valor
 * que recibió el componente y no una cadena que la página escribió por su cuenta. */
const flags = vi.hoisted(() => ({
  decisionBrief: true,
  inicioMvp: true,
  dashboardSummary: true,
  financialDecisionHome: true,
  inicioEjecutivoV2: false,
  inicioWidgets: true,
  inicioAgenda: true,
  hoyV01: true,
  bankMovementClassification: true,
  cashFlowReport: true,
  bankBalances: true,
  reconciliationReview: true,
  cajaV2: true,
  cajaV3: true,
  cajaDashboard: false,
  cajaMarkCollected: true,
  cajaV02: true,
  bandejaV07: true,
  siiQueries: true,
  accountsPayable: true,
  pagarV2: true,
  pagarV05: true,
  accountsReceivable: true,
  cobrarV2: true,
  cobrarV04: true,
}));

vi.mock("@/lib/feature-flags", () => ({ resolveFeatureFlags: () => flags }));

vi.mock("@/components/decision-brief/decision-brief-slot", () => ({
  DecisionBriefSlot: ({ surface }: { surface: string }) => (
    <div data-decision-brief-surface={surface}>brief:{surface}</div>
  ),
}));

vi.mock("@/components/inicio/v01/hoy-live", () => ({
  HoyLive: ({ suppressRecommendations }: { suppressRecommendations?: boolean }) => (
    <div>hoy-live suppress={String(Boolean(suppressRecommendations))}</div>
  ),
}));
vi.mock("@/components/caja/v02/caja-v02-live", () => ({
  CajaV02Live: ({ suppressRecommendations }: { suppressRecommendations?: boolean }) => (
    <div>caja-v02 suppress={String(Boolean(suppressRecommendations))}</div>
  ),
}));
vi.mock("@/components/bandeja/v07/bandeja-v07-live", () => ({
  BandejaV07Live: ({ secondaryAudit }: { secondaryAudit?: boolean }) => (
    <div>bandeja-v07 secondary={String(Boolean(secondaryAudit))}</div>
  ),
}));
vi.mock("@/components/pagar/v05/pagar-v05-live", () => ({
  PagarV05Live: ({ suppressRecommendations }: { suppressRecommendations?: boolean }) => (
    <div>pagar-v05 suppress={String(Boolean(suppressRecommendations))}</div>
  ),
}));
vi.mock("@/components/cobrar/gestion-cobros-live", () => ({
  GestionCobrosLive: ({ suppressRecommendations }: { suppressRecommendations?: boolean }) => (
    <div>gestion-cobros suppress={String(Boolean(suppressRecommendations))}</div>
  ),
}));

import BandejaPage from "./bandeja/page";
import CajaPage from "./caja/page";
import CobrarPage from "./cobrar/page";
import InicioPage from "./inicio/page";
import PagarPage from "./pagar/page";

type Wiring = {
  surface: string;
  Page: () => React.JSX.Element;
  /** Marca que el doble imprime cuando recibió el modo evidencia. */
  evidence: string;
  /** El mismo doble con el modo apagado: gemelo del assert negativo. */
  ranking: string;
};

const WIRING: Wiring[] = [
  {
    surface: "inicio",
    Page: InicioPage,
    evidence: "hoy-live suppress=true",
    ranking: "hoy-live suppress=false",
  },
  {
    surface: "caja",
    Page: CajaPage,
    evidence: "caja-v02 suppress=true",
    ranking: "caja-v02 suppress=false",
  },
  {
    surface: "bandeja",
    Page: BandejaPage,
    evidence: "bandeja-v07 secondary=true",
    ranking: "bandeja-v07 secondary=false",
  },
  {
    surface: "pagar",
    Page: PagarPage,
    evidence: "pagar-v05 suppress=true",
    ranking: "pagar-v05 suppress=false",
  },
  {
    surface: "cobrar",
    Page: CobrarPage,
    evidence: "gestion-cobros suppress=true",
    ranking: "gestion-cobros suppress=false",
  },
];

describe("Cableado del Decision Brief en las cinco superficies", () => {
  beforeEach(() => {
    flags.decisionBrief = true;
  });

  it.each(WIRING)(
    "$surface monta el Brief primero y conserva su vista en modo evidencia",
    ({ surface, Page, evidence, ranking }) => {
      const html = renderToStaticMarkup(<Page />);

      expect(html).toContain(`data-decision-brief-surface="${surface}"`);
      expect(html).toContain(evidence);
      expect(html).not.toContain(ranking);
      // "Primero" es literal: el envelope del servidor precede a la evidencia local.
      expect(html.indexOf(`brief:${surface}`)).toBeLessThan(html.indexOf(evidence));
    },
  );

  it.each(WIRING)(
    "$surface con el flag apagado no monta el Brief y mantiene su ranking",
    ({ surface, Page, evidence, ranking }) => {
      flags.decisionBrief = false;
      const html = renderToStaticMarkup(<Page />);

      expect(html).not.toContain(`data-decision-brief-surface="${surface}"`);
      expect(html).toContain(ranking);
      expect(html).not.toContain(evidence);
    },
  );
});
