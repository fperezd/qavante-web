import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";
import { Dashboard } from "./inicio-ejecutivo-view";

const financialDecision = {
  priority: 1,
  reason: "Revisa el pago que evita que tu caja quede bajo cero",
  deadline: "Hoy",
  cta_label: "Ver propuesta",
  cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
};

const summary: DashboardSummaryResponse = {
  generated_at: "2026-09-13T12:00:00Z",
  executive_phrase: "Tu caja necesita una decisión.",
  pulso: null,
  cash_today: null,
  cash_forecast: null,
  cash_gap: null,
  overdue_collections: null,
  critical_payments: null,
  operational_result: null,
  priority_actions: [
    financialDecision,
    {
      ...financialDecision,
      priority: 2,
      reason: "Mantén la segunda decisión del servidor",
      cta_label: "Ver segunda propuesta",
      cta_href: "/caja/conciliacion?decision_id=segunda-decision",
    },
    {
      ...financialDecision,
      priority: 3,
      reason: "Mantén la tercera decisión del servidor",
      cta_label: "Ver tercera propuesta",
      cta_href: "/pagar?decision_id=tercera-decision",
    },
    {
      ...financialDecision,
      priority: 4,
      reason: "Mantén la cuarta decisión del servidor",
      cta_label: "Ver cuarta propuesta",
      cta_href: "/cobrar?decision_id=cuarta-decision",
    },
  ],
};

describe("Dashboard · priority_actions server-owned", () => {
  it("mantiene visible una decisión financiera con ruta de conciliación y no anuncia auditoría sin feed", () => {
    const html = renderToStaticMarkup(<Dashboard data={summary} />);

    expect(html).toContain("Revisa el pago que evita que tu caja quede bajo cero");
    expect(html).toContain("Ver propuesta");
    expect(html).toContain('href="/caja/conciliacion?decision_id=evitar-caja-negativa"');
    expect(html).toContain("Mantén la cuarta decisión del servidor");
    expect(html).toContain('href="/cobrar?decision_id=cuarta-decision"');
    expect(html).not.toContain("Calidad del dato");
    expect(html).not.toContain("Hay movimientos pendientes de revisión");
  });
});
