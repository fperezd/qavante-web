import type { LiquidityEvaluation } from "@/lib/api/financial-decisions";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

export interface LiquidityAlternativeView {
  id: string;
  title: string;
  position: number | null;
  recommended: boolean;
  rejected: boolean;
  explanation: string | null;
  costLabel: string;
  evidenceLabel: string | null;
}

export interface LiquidityEvaluationView {
  decisionSupport: "eligible" | "abstain";
  status: string;
  asOfLabel: string;
  validityLabel: string;
  valid: boolean;
  expired: boolean;
  horizonLabel: string;
  gapLabel: string | null;
  minimumCashLabel: string | null;
  recoveryLabel: string | null;
  alternatives: LiquidityAlternativeView[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown, currency: string): string | null {
  const parsed = parseAmountOrNull(typeof value === "string" ? value : null);
  return parsed == null ? null : formatMoney(parsed, currency);
}

function alternativeTitle(code: string, family: string, isNoAction: boolean): string {
  if (isNoAction || code === "no_action") return "No financiar";
  if (code.startsWith("credit_line") || family === "credit_line") return "Usar línea de crédito";
  if (code.startsWith("factoring") || family === "factoring") return "Factorizar factura completa";
  return "Alternativa evaluada";
}

function explanationLabel(value: unknown): string | null {
  const explanation = record(value);
  if (!explanation) return null;
  /* `reason` suele ser un código interno (p. ej. `credit_line:quote-1`). Sólo los campos
     explícitamente narrativos pueden llegar a pantalla; un código no es una explicación. */
  return stringValue(explanation.summary) ?? stringValue(explanation.description);
}

export function liquidityEvaluationView(
  value: LiquidityEvaluation,
  now: Date = new Date(),
): LiquidityEvaluationView {
  const event = record(value.event) ?? {};
  const validUntil = value.scope.valid_until ? new Date(value.scope.valid_until) : null;
  const expired = validUntil != null && Number.isFinite(validUntil.valueOf()) && validUntil < now;
  const valid = validUntil != null && Number.isFinite(validUntil.valueOf()) && validUntil >= now;

  return {
    decisionSupport: value.decision_support,
    status: value.status,
    asOfLabel: formatDateLike(value.scope.as_of),
    validityLabel: validUntil
      ? `${valid ? "Vigente hasta" : expired ? "Venció" : "Vigencia inválida:"} ${formatDateLike(
          value.scope.valid_until,
        )}`
      : "Vigencia no informada",
    valid,
    expired,
    horizonLabel: `${value.scope.horizon_days} días`,
    gapLabel: money(event.amount_peak, value.scope.currency),
    minimumCashLabel: money(event.baseline_min_cash, value.scope.currency),
    recoveryLabel: stringValue(event.recovery_date)
      ? formatDateLike(String(event.recovery_date))
      : null,
    /* El orden y el rank pertenecen al snapshot. No se recalculan ni se corrigen en la vista. */
    alternatives: value.alternatives.map((alternative) => {
      let costLabel: string;
      let evidenceLabel: string | null = null;
      if (alternative.cost_status === "known" && alternative.cost) {
        costLabel = `Costo financiero total ${formatMoney(
          Number(alternative.cost.total_financial_cost),
          value.scope.currency,
        )}`;
        evidenceLabel = `${alternative.cost.evidence_refs.length} evidencia${
          alternative.cost.evidence_refs.length === 1 ? "" : "s"
        } verificable${alternative.cost.evidence_refs.length === 1 ? "" : "s"}`;
      } else if (alternative.cost_status === "unknown") {
        costLabel = "Costo aún no verificable";
      } else {
        costLabel = "Costo financiero: no aplica";
      }
      return {
        id: alternative.id,
        title: alternativeTitle(alternative.code, alternative.family, alternative.is_no_action),
        position: alternative.rank ?? null,
        recommended: value.recommended_alternative_id === alternative.id,
        rejected: alternative.is_rejected,
        explanation: explanationLabel(alternative.explanation),
        costLabel,
        evidenceLabel,
      };
    }),
  };
}
