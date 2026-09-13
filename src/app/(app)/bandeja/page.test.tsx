import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const arnes = vi.hoisted(() => ({
  bandejaV07: true,
}));

vi.mock("@/lib/feature-flags", () => ({
  resolveFeatureFlags: () => ({ bandejaV07: arnes.bandejaV07 }),
}));

vi.mock("@/components/bandeja/v07/bandeja-v07-live", () => ({
  BandejaV07Live: () => <div data-testid="bandeja-v07-live">Cola viva de Bandeja</div>,
}));

vi.mock("@/components/bandeja/bandeja-audit-landing", () => ({
  BandejaAuditLanding: () => <div data-testid="bandeja-audit-landing">Landing de auditoría</div>,
}));

vi.mock("@/components/decisions/cash-decision-brief", () => ({
  CashDecisionBriefCard: () => <div data-testid="cash-decision-brief">Decisión de caja</div>,
}));

import BandejaPage from "./page";

describe("BandejaPage", () => {
  it("preserva la cola V07 viva cuando el flag está habilitado", () => {
    arnes.bandejaV07 = true;

    const html = renderToStaticMarkup(<BandejaPage />);

    expect(html).toContain('data-testid="bandeja-v07-live"');
    expect(html).toContain("Cola viva de Bandeja");
    expect(html).not.toContain("Landing de auditoría");
  });
});
