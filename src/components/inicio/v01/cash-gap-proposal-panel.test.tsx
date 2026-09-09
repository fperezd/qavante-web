import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CashGapProposalPanel } from "./cash-gap-proposal-panel";

const EM_DASH = /\u2014/;

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("CashGapProposalPanel", () => {
  it("normaliza U+2014 sólo al presentar un target dinámico", () => {
    const rawLabel = "BANCO BICE — Factura 3218763";
    expect(rawLabel).toMatch(EM_DASH);

    const proposals = [
      {
        kind: "payment_plan" as const,
        label: "Negociar pagos críticos",
        explanation: "La evidencia permite priorizar esta alternativa.",
        confidence: "medium" as const,
        evidenceCount: 1,
        caveats: [],
        targets: [{ label: rawLabel, amount: "120000", reason: "vence primero" }],
        impacts: [],
        href: "/pagar" as const,
        cta: "Revisar pagos propuestos",
      },
    ];

    const rendered = text(
      renderToStaticMarkup(<CashGapProposalPanel loading={false} proposals={proposals} />),
    );

    expect(rendered).toContain("BANCO BICE · Factura 3218763 · vence primero");
    expect(rendered).not.toMatch(EM_DASH);
    expect(proposals[0]?.targets[0]?.label).toBe(rawLabel);
  });

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
            caveats: ["Una o más fuentes pueden estar desactualizadas."],
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
    expect(rendered).toContain("Antes de actuar");
    expect(rendered).toContain("Una o más fuentes pueden estar desactualizadas.");
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
            caveats: [
              "La propuesta se basa en información parcial; pueden faltar documentos o vencimientos.",
            ],
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
    expect(rendered).toContain("pueden faltar documentos o vencimientos");
    expect(rendered).not.toContain("missing_due_dates");
    expect(rendered).not.toContain("$120.000");
  });
});
