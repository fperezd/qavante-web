import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { DecisionBriefPanel } from "./decision-brief-panel";

const DECISION_ID = "6cb9e47a-f682-46d6-9d8a-3c851c8ff420";
const CONTEXT_HASH = "ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f";
const REVIEW_PAYMENTS_HREF =
  "/pagar?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f";

const BRIEF = {
  contract_version: "cash-decision-brief.v1",
  decision_id: DECISION_ID,
  context_hash: CONTEXT_HASH,
  as_of: "2026-09-12",
  horizon_days: 14,
  decision_kind: "financial_decision",
  state: "recommended",
  confidence: "high",
  currency: "CLP",
  problem: {
    title: "Tu caja no alcanza para cubrir los próximos pagos",
    summary: "Los pagos programados superan la caja proyectada.",
    amount: { amount: "52418151", currency: "CLP", label: "Faltante proyectado" },
  },
  alternatives: [
    {
      alternative_id: "d5e9dbcf-00d8-4e6e-bffd-9f67afdc4db7",
      code: "review_payments",
      decision_kind: "financial_decision",
      state: "available",
      title: "Primera alternativa del servidor",
      description: "No se reordena en el cliente.",
      cta_label: "Revisar pagos",
      cta_href: REVIEW_PAYMENTS_HREF,
      requires_human_confirmation: true,
      targets: [],
    },
    {
      alternative_id: "05cc2271-facd-4c5a-92f8-cf6b55e1119c",
      code: "no_action",
      decision_kind: "financial_decision",
      state: "available",
      title: "Segunda alternativa del servidor",
      description: "Se mantiene después de la primera.",
      cta_label: "Ver proyección",
      cta_href:
        "/caja/proyeccion?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
      requires_human_confirmation: false,
      targets: [],
    },
  ],
  recommended_alternative_id: "d5e9dbcf-00d8-4e6e-bffd-9f67afdc4db7",
  evidence: [
    {
      kind: "cash_projection",
      label: "Menor saldo proyectado",
      note: "Proyección de caja de 14 días.",
      amount: { amount: "-52418151", currency: "CLP", label: "Menor saldo proyectado" },
      observed_on: "2026-09-12",
    },
  ],
  freshness: { state: "current", as_of: "2026-09-12", summary: "Actualizada el 12-09-2026" },
  coverage: {
    state: "partial",
    summary: "La proyección usa las fuentes disponibles para este período.",
    dated_items: 8,
    undated_items: 12,
    excluded_other_currency_items: 0,
    assumed_receivables_excluded: {
      amount: "1800000",
      currency: "CLP",
      label: "Cobros estimados excluidos",
    },
    assumed_receivables_excluded_count: 3,
  },
  uncertainties: [
    {
      kind: "pending_interpretation",
      summary: "Hay movimientos en revisión automática; no cambian esta evaluación.",
      item_count: 12,
      monetary_effect: "not_material_to_bank_balance",
      blocks_recommendation: false,
    },
  ],
  secondary_actions: [
    {
      decision_kind: "data_quality_audit",
      title: "Revisar movimientos pendientes",
      description: "Sólo si necesitas confirmar una excepción concreta.",
      item_count: 12,
      cta_label: "Abrir auditoría",
      cta_href:
        "/caja/por-clasificar?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
    },
  ],
} satisfies CashDecisionBrief;

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("DecisionBriefPanel — envelope server-owned", () => {
  it("conserva identidad, orden y CTA literal de la respuesta del servidor", () => {
    const html = renderToStaticMarkup(<DecisionBriefPanel brief={BRIEF} />);

    expect(html).toContain(`data-decision-id="${DECISION_ID}"`);
    expect(html).toContain(`data-context-hash="${CONTEXT_HASH}"`);
    expect(html).toContain('data-decision-confidence="high"');
    expect(text(html)).toContain("Corte: 12-09-2026");
    expect(text(html)).toContain("Confianza: Alta");
    expect(html.indexOf("Primera alternativa del servidor")).toBeLessThan(
      html.indexOf("Segunda alternativa del servidor"),
    );
    expect(html).toContain(
      'href="/pagar?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&amp;context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f"',
    );
    expect(text(html)).toContain("Requiere tu confirmación antes de realizar cualquier acción.");
  });

  it("deja la auditoría después de las alternativas y no la convierte en la acción principal", () => {
    const html = renderToStaticMarkup(<DecisionBriefPanel brief={BRIEF} />);

    expect(html.indexOf("Revisión opcional de datos")).toBeGreaterThan(
      html.indexOf("Segunda alternativa del servidor"),
    );
    expect(text(html)).toContain("Esto no reemplaza la decisión que estás evaluando arriba.");
  });

  it("expone cada límite de cobertura que declaró el servidor sin sumar ni completar cifras", () => {
    const rendered = text(renderToStaticMarkup(<DecisionBriefPanel brief={BRIEF} />));

    expect(rendered).toContain("Información que quedó fuera de esta evaluación");
    expect(rendered).toContain("Cobros estimados excluidos · $1.800.000 · 3 cobros estimados");
    expect(rendered).toContain("Registros sin fecha de vencimiento: 12");
    expect(rendered).not.toContain("Registros en otra moneda:");
  });

  /* INV-FX-001: lo que no es CLP queda fuera y hay que decirlo. El caso de arriba
     afirma la ausencia con el conteo en 0; éste es su gemelo con la MISMA cadena
     y el conteo publicado, para que ese negativo no pueda pasar por bueno solo. */
  it("declara los registros en otra moneda cuando el servidor publica un conteo", () => {
    const brief: CashDecisionBrief = {
      ...BRIEF,
      coverage: { ...BRIEF.coverage, excluded_other_currency_items: 2 },
    };

    const rendered = text(renderToStaticMarkup(<DecisionBriefPanel brief={brief} />));
    expect(rendered).toContain("Registros en otra moneda: 2");
  });

  it("declara los vencimientos estimados del contrato sin sumarlos a la decisión", () => {
    const conditional: CashDecisionBrief = {
      ...BRIEF,
      coverage: {
        ...BRIEF.coverage,
        conditional_due_date_items_14d: 4,
        conditional_due_date_payments_14d: {
          amount: "3200000",
          currency: "CLP",
          label: "Pagos con fecha estimada",
        },
        conditional_due_date_collections_14d: {
          amount: "1500000",
          currency: "CLP",
          label: "Cobros con fecha estimada",
        },
      },
    };

    const rendered = text(renderToStaticMarkup(<DecisionBriefPanel brief={conditional} />));
    expect(rendered).toContain("Registros con vencimiento estimado, no confirmado: 4");
    expect(rendered).toContain("Pagos con vencimiento estimado en el período: $3.200.000");
    expect(rendered).toContain("Cobros con vencimiento estimado en el período: $1.500.000");
    // El faltante publicado no cambia: lo condicional se declara, no se suma.
    expect(rendered).toContain("$52.418.151");

    // Gemelos: sin los campos del contrato ninguna de las tres filas aparece.
    const sinCondicionales = text(renderToStaticMarkup(<DecisionBriefPanel brief={BRIEF} />));
    expect(sinCondicionales).not.toContain("Registros con vencimiento estimado, no confirmado:");
    expect(sinCondicionales).not.toContain("Pagos con vencimiento estimado en el período:");
    expect(sinCondicionales).not.toContain("Cobros con vencimiento estimado en el período:");
  });

  it("no transforma un monto sin valor verificable en cero", () => {
    const brief: CashDecisionBrief = {
      ...BRIEF,
      problem: {
        ...BRIEF.problem,
        amount: { amount: "", currency: "CLP", label: "Faltante proyectado" },
      },
    };

    const rendered = text(renderToStaticMarkup(<DecisionBriefPanel brief={brief} />));
    expect(rendered).toContain("Tu caja no alcanza para cubrir los próximos pagos");
    expect(rendered).not.toContain("$0");
  });

  it("renderiza Decimal exacto sin pasar por IEEE-754, incluidos negativos y fracciones CLP", () => {
    const brief: CashDecisionBrief = {
      ...BRIEF,
      problem: {
        ...BRIEF.problem,
        amount: {
          amount: "9007199254740993.50",
          currency: "CLP",
          label: "Faltante proyectado",
        },
      },
      evidence: [
        {
          kind: "cash_projection",
          label: "Menor saldo proyectado",
          note: "Conserva el Decimal del contrato.",
          amount: {
            amount: "-9007199254740993.005",
            currency: "CLP",
            label: "Menor saldo proyectado",
          },
          observed_on: "2026-09-12",
        },
      ],
    };

    const rendered = text(renderToStaticMarkup(<DecisionBriefPanel brief={brief} />));
    expect(rendered).toContain("$9.007.199.254.740.993,50");
    expect(rendered).toContain("−$9.007.199.254.740.993,005");
    expect(rendered).not.toContain("$9.007.199.254.740.992");
  });

  /* Los dos límites que el review R2 pidió por nombre: un entero por encima de
     2^53, donde `Number()` ya cambia el último dígito, y una fracción CLP que
     el redondeo al peso borraría. Cada negativo lleva su positivo gemelo con la
     MISMA cifra para que no pase por bueno un assert que nunca casa. */
  it("renderiza el entero sobre 2^53 y la fracción CLP tal como los publicó el contrato", () => {
    const exacto = (amount: string): string =>
      text(
        renderToStaticMarkup(
          <DecisionBriefPanel
            brief={{
              ...BRIEF,
              problem: { ...BRIEF.problem, amount: { ...BRIEF.problem.amount, amount } },
            }}
          />,
        ),
      );

    // Number("9007199254740993") === 9007199254740992: la pérdida sería visible.
    expect(Number("9007199254740993")).toBe(9007199254740992);
    const grande = exacto("9007199254740993");
    expect(grande).toContain("$9.007.199.254.740.993");
    expect(grande).not.toContain("$9.007.199.254.740.992");

    const fraccion = exacto("1234.56");
    expect(fraccion).toContain("$1.234,56");
    expect(fraccion).not.toContain("$1.235");
  });
});
