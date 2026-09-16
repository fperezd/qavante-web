import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* #305: con el Decision Brief encendido, el header deja de mostrar el Pulso
   heredado (semáforo + palabra de estado) para no contradecir al Brief de la
   misma pantalla. Reproduce el caso observado en prod (21779dd4, 2026-09-15):
   "Pulso 33 · Crítica" en el header mientras el Brief se abstiene.

   `useDashboardSummary` se mockea (no hay QueryClientProvider acá, mismo
   patrón que `financiamiento-v13-live.test.tsx`); `llamadas` deja verificar
   con qué `enabled` se invocó, para afirmar que ON deja de pedir el summary. */

const arnes = vi.hoisted(() => ({ llamadasEnabled: [] as boolean[] }));

vi.mock("@/lib/api/users", () => ({
  useMe: () => ({ data: { user: { name: "Fernando Pérez" } } }),
}));

vi.mock("@/lib/api/dashboard", () => ({
  useDashboardSummary: (enabled: boolean = true) => {
    arnes.llamadasEnabled.push(enabled);
    return {
      data: { pulso: { score: 33, status: "critical" } },
    };
  },
}));

vi.mock("./company-switcher", () => ({ CompanySwitcher: () => null }));
vi.mock("./sync-all-button", () => ({ SyncAllButton: () => null }));
vi.mock("./sync-status-indicator", () => ({ SyncStatusIndicator: () => null }));

import { AppHeader } from "./header";

function html(decisionBriefEnabled?: boolean) {
  return renderToStaticMarkup(
    <AppHeader onMenuClick={() => undefined} decisionBriefEnabled={decisionBriefEnabled} />,
  );
}

/* Mismas dos regex en el gemelo positivo (OFF) y el negativo (ON) — un
   `not.toMatch` sin un `toMatch` que la misma regex sí cumpla en algún caso
   es un assert hueco (nunca falla, casase o no la UI con el defecto). */
const PULSO_LABEL = /Pulso/;
const ESTADO_CRITICA = /Crítica/;

describe("AppHeader · Pulso heredado vs Decision Brief (#305)", () => {
  beforeEach(() => {
    arnes.llamadasEnabled.length = 0;
  });

  it("con el flag OFF muestra el Pulso heredado, byte a byte como hoy", () => {
    const rendered = html(false);

    expect(rendered).toMatch(PULSO_LABEL);
    expect(rendered).toMatch(ESTADO_CRITICA);
    expect(arnes.llamadasEnabled).toEqual([true]);
  });

  it("sin pasar el flag (undefined) también muestra el Pulso heredado", () => {
    const rendered = html(undefined);

    expect(rendered).toMatch(PULSO_LABEL);
    expect(rendered).toMatch(ESTADO_CRITICA);
  });

  it("con el flag ON deja de mostrar el Pulso heredado y su semáforo", () => {
    const rendered = html(true);

    expect(rendered).not.toMatch(PULSO_LABEL);
    expect(rendered).not.toMatch(ESTADO_CRITICA);
  });

  it("con el flag ON deja de pedir /api/dashboard/summary desde el header", () => {
    html(true);

    expect(arnes.llamadasEnabled).toEqual([false]);
  });
});
