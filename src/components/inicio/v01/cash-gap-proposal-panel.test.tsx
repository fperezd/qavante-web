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
  it.each(["high", "medium", "low", "preliminary"] as const)(
    "omite la calificación %s sin ocultar límites ni cambiar importes",
    (confidence) => {
      const limitation =
        "No existe una PolicyConstraint versionada, vigente y no ambigua para este plan, ni un mínimo de caja CLP declarado por la empresa; la propuesta usa sólo evidencia concreta y queda con confianza baja, sin asumir un mínimo de caja de $0.";
      const proposal = {
        kind: "payment_plan" as const,
        label: "Revisar pagos",
        explanation: "Proyección a 14 días",
        confidence,
        evidenceCount: 1,
        limitations: [limitation, "Faltan vencimientos", "Banco desactualizado"],
        targets: [],
        impacts: [
          {
            metric: "cash_gap_14d",
            value: "120000",
            currency: "CLP",
            confidence,
            confidence_method: "evidence_bounded",
          },
        ],
        href: "/pagar" as const,
        cta: "Revisar pagos propuestos",
      };
      const rendered = text(
        renderToStaticMarkup(<CashGapProposalPanel loading={false} proposals={[proposal]} />),
      );
      expect(rendered).not.toMatch(/confianza|PolicyConstraint/i);
      expect(rendered).toContain("$120.000");
      expect(rendered).toContain("Faltan vencimientos");
      expect(rendered).toContain("Banco desactualizado");
      expect(rendered).toContain("no supone un mínimo de caja de $0");
      expect(rendered.includes("Propuesta preliminar")).toBe(confidence === "preliminary");
      expect(proposal.limitations[0]).toBe(limitation);
      expect(proposal.confidence).toBe(confidence);
    },
  );

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
        limitations: [],
        targets: [
          {
            label: rawLabel,
            amount: "120000",
            reason: "vence primero",
            due_date_certainty: "confirmed" as const,
          },
        ],
        impacts: [],
        href: "/pagar" as const,
        cta: "Revisar pagos propuestos",
      },
    ];

    const rendered = text(
      renderToStaticMarkup(<CashGapProposalPanel loading={false} proposals={proposals} />),
    );

    expect(rendered).toContain("BANCO BICE · Factura 3218763");
    expect(rendered).not.toContain("vence primero");
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
            limitations: ["source_stale:sii_rcv"],
            targets: [
              {
                label: "Remuneraciones de agosto",
                amount: "7400000",
                /* Prosa cruda del transporte: el panel NO puede reflejarla. */
                reason: "Bearer secret-token SELECT * FROM users /api/internal",
                due_date_certainty: "confirmed" as const,
              },
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
    expect(rendered).toContain("Límites informados");
    expect(rendered).toContain("Una o más fuentes pueden estar desactualizadas.");
    expect(rendered).not.toContain("source_stale:sii_rcv");
    expect(rendered).toContain("Remuneraciones de agosto");
    expect(rendered).not.toContain("Bearer secret-token");
    expect(rendered).not.toContain("/api/internal");
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
            limitations: ["missing_due_dates"],
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
    expect(rendered).toContain("Faltan fechas de vencimiento para completar la evaluación.");
    expect(rendered).not.toContain("missing_due_dates");
    expect(rendered).not.toContain("$120.000");
  });
});
