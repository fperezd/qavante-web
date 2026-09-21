import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const arnes = vi.hoisted(() => ({
  bandejaV07: true,
  decisionBrief: false,
}));

vi.mock("@/lib/feature-flags", () => ({
  resolveFeatureFlags: () => ({
    bandejaV07: arnes.bandejaV07,
    decisionBrief: arnes.decisionBrief,
  }),
}));

vi.mock("@/components/bandeja/v07/bandeja-v07-live", () => ({
  BandejaV07Live: () => <div data-testid="bandeja-v07-live">Cola viva de Bandeja</div>,
}));

vi.mock("@/components/bandeja/bandeja-scope", () => ({
  BandejaScope: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/bandeja/bandeja-audit-landing", () => ({
  BandejaAuditLanding: () => <div data-testid="bandeja-audit-landing">Landing de auditoría</div>,
}));

import BandejaPage from "./page";

vi.mock("@/components/bandeja/work-inbox-summary", () => ({
  WorkInboxSummary: () => <div data-testid="work-inbox">Cuatro colas</div>,
}));

describe("BandejaPage", () => {
  it("preserva la cola V07 viva cuando el flag está habilitado", async () => {
    arnes.bandejaV07 = true;

    const html = renderToStaticMarkup(await BandejaPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('data-testid="bandeja-v07-live"');
    expect(html).toContain('data-testid="work-inbox"');
    expect(html).toContain("Cola viva de Bandeja");
    expect(html).not.toContain("Landing de auditoría");
  });
});
