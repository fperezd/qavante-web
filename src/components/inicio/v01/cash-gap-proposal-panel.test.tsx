import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CashGapProposalPanel } from "./cash-gap-proposal-panel";

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("CashGapProposalPanel", () => {
  it("muestra una propuesta del backend con su impacto y CTA, sin inventar moneda en los targets", () => {
    const html = renderToStaticMarkup(
      <CashGapProposalPanel
        loading={false}
        proposals={[
          {
            kind: "payment_plan",
            label: "Negociar pagos críticos",
            explanation: "La evidencia permite priorizar esta alternativa.",
            confidence: "medium",
            evidenceCount: 1,
            targets: [
              { label: "Remuneraciones de agosto", amount: "7400000", reason: "vence primero" },
            ],
            impacts: [
              {
                metric: "cash_gap_14d",
                value: "1121250",
                currency: "CLP",
                horizon_days: 14,
                confidence: "medium",
                confidence_method: "evidence_bounded",
              },
            ],
            href: "/pagar",
            cta: "Revisar pagos propuestos",
          },
        ]}
      />,
    );
    const rendered = text(html);

    expect(rendered).toContain("Propuesta para proteger tu caja");
    expect(rendered).toContain("Negociar pagos críticos");
    expect(rendered).toContain("$1.121.250");
    expect(rendered).toContain("Remuneraciones de agosto · vence primero");
    expect(html).toContain('href="/pagar"');
    expect(rendered).not.toContain("Remuneraciones de agosto · $7.400.000");
  });

  it("no abre un bloque vacío cuando el backend se abstiene", () => {
    const html = renderToStaticMarkup(<CashGapProposalPanel loading={false} proposals={[]} />);
    expect(html).toBe("");
  });

  it("no asigna CLP a un impacto cuya moneda no fue publicada", () => {
    const html = renderToStaticMarkup(
      <CashGapProposalPanel
        loading={false}
        proposals={[
          {
            kind: "collection_plan",
            label: "Cobrar documentos priorizados",
            explanation: "Hay evidencia para revisar esta alternativa.",
            confidence: "low",
            evidenceCount: 0,
            targets: [],
            impacts: [
              {
                metric: "cash_gap_14d",
                value: "120000",
                currency: null,
                confidence: "low",
                confidence_method: "rule_based",
              },
            ],
            href: "/cobrar",
            cta: "Revisar cobros propuestos",
          },
        ]}
      />,
    );
    const rendered = text(html);
    expect(rendered).toContain("Sin monto publicable");
    expect(rendered).not.toContain("$120.000");
  });
});
