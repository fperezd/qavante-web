import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, ShieldAlert } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { formatMoneyFromDecimalString, isNonZeroDecimalString } from "@/lib/formatters/clp";
import { formatCount } from "@/lib/formatters/count";
import { formatDateLike } from "@/lib/formatters/date";

type BriefAlternative = CashDecisionBrief["alternatives"][number];
type BriefMoney = NonNullable<CashDecisionBrief["problem"]["amount"]>;

/**
 * Presentación literal del contrato de decisión. Este componente no decide qué
 * mostrar: conserva el orden, los ids y los CTA que recibió del servidor.
 */
export function DecisionBriefPanel({ brief }: { brief: CashDecisionBrief }) {
  const amount = formatBriefMoney(brief.problem.amount);
  const coverageImpact = brief.coverage.assumed_receivables_excluded;
  const coverageImpactAmount = formatBriefMoney(coverageImpact);
  const hasCoverageImpactAmount = hasNonZeroAmount(coverageImpact);
  /* Vencimientos condicionales: el servidor los publica cuando la fecha es
     estimada y por eso NO confirma que el documento caiga dentro del período.
     Se declaran aparte, nunca sumados a las cifras de la decisión. */
  const conditionalPayments = brief.coverage.conditional_due_date_payments_14d;
  const conditionalCollections = brief.coverage.conditional_due_date_collections_14d;
  const conditionalPaymentsAmount = formatBriefMoney(conditionalPayments);
  const conditionalCollectionsAmount = formatBriefMoney(conditionalCollections);
  const hasConditionalPayments = hasNonZeroAmount(conditionalPayments);
  const hasConditionalCollections = hasNonZeroAmount(conditionalCollections);
  const hasCoverageImpact =
    hasCoverageImpactAmount ||
    isPositiveCount(brief.coverage.assumed_receivables_excluded_count) ||
    isPositiveCount(brief.coverage.undated_items) ||
    isPositiveCount(brief.coverage.excluded_other_currency_items) ||
    isPositiveCount(brief.coverage.conditional_due_date_items_14d) ||
    hasConditionalPayments ||
    hasConditionalCollections;

  return (
    <QavanteCard
      variant="bordered"
      data-testid="cash-decision-brief"
      data-decision-id={brief.decision_id}
      data-context-hash={brief.context_hash}
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Decisión de caja · próximos {brief.horizon_days} días</span>
            <span className="text-xs font-normal text-neutral-mid">
              Corte: {formatDateLike(brief.as_of)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Confidence confidence={brief.confidence} />
            <Freshness freshness={brief.freshness} />
          </div>
        </div>
      }
    >
      <section aria-labelledby="decision-brief-problem" className="space-y-2">
        <div className="flex items-start gap-2.5">
          <ProblemIcon state={brief.state} />
          <div className="min-w-0">
            <h2 id="decision-brief-problem" className="text-lg font-semibold text-neutral-dark">
              {brief.problem.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-mid">{brief.problem.summary}</p>
            {amount && (
              <p className="mt-2 font-semibold tabular-nums text-neutral-dark">{amount}</p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Alternativas evaluadas"
        className="mt-4 space-y-3 border-t border-border pt-4"
      >
        {brief.alternatives.map((alternative) => (
          <AlternativeRow
            key={alternative.alternative_id}
            alternative={alternative}
            recommended={alternative.alternative_id === brief.recommended_alternative_id}
          />
        ))}
      </section>

      <section className="mt-4 border-t border-border pt-3" aria-label="Cobertura de la decisión">
        <p className="text-sm text-neutral-mid">{brief.coverage.summary}</p>
      </section>

      {hasCoverageImpact && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-coverage-impact"
        >
          <h3
            id="decision-brief-coverage-impact"
            className="text-sm font-semibold text-neutral-dark"
          >
            Información que quedó fuera de esta evaluación
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-mid">
            {coverageImpact &&
              (hasCoverageImpactAmount ||
                isPositiveCount(brief.coverage.assumed_receivables_excluded_count)) && (
                <li>
                  <span className="font-medium text-neutral-dark">{coverageImpact.label}</span>
                  {hasCoverageImpactAmount && coverageImpactAmount && (
                    <span className="tabular-nums text-neutral-dark">
                      {" "}
                      · {coverageImpactAmount}
                    </span>
                  )}
                  {isPositiveCount(brief.coverage.assumed_receivables_excluded_count) && (
                    <span>
                      {" "}
                      · {formatCount(brief.coverage.assumed_receivables_excluded_count)} cobros
                      estimados
                    </span>
                  )}
                </li>
              )}
            {!coverageImpact &&
              isPositiveCount(brief.coverage.assumed_receivables_excluded_count) && (
                <li>
                  Cobros estimados excluidos{": "}
                  {formatCount(brief.coverage.assumed_receivables_excluded_count)}
                </li>
              )}
            {isPositiveCount(brief.coverage.undated_items) && (
              <li>
                Registros sin fecha de vencimiento{": "}
                {formatCount(brief.coverage.undated_items)}
              </li>
            )}
            {isPositiveCount(brief.coverage.excluded_other_currency_items) && (
              <li>
                Registros en otra moneda{": "}
                {formatCount(brief.coverage.excluded_other_currency_items)}
              </li>
            )}
            {isPositiveCount(brief.coverage.conditional_due_date_items_14d) && (
              <li>
                Registros con vencimiento estimado, no confirmado{": "}
                {formatCount(brief.coverage.conditional_due_date_items_14d)}
              </li>
            )}
            {hasConditionalPayments && conditionalPaymentsAmount && (
              <li>
                Pagos con vencimiento estimado en el período{": "}
                <span className="tabular-nums text-neutral-dark">{conditionalPaymentsAmount}</span>
              </li>
            )}
            {hasConditionalCollections && conditionalCollectionsAmount && (
              <li>
                Cobros con vencimiento estimado en el período{": "}
                <span className="tabular-nums text-neutral-dark">
                  {conditionalCollectionsAmount}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      {brief.evidence && brief.evidence.length > 0 && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-evidence"
        >
          <h3 id="decision-brief-evidence" className="text-sm font-semibold text-neutral-dark">
            Información considerada
          </h3>
          <ul className="mt-2 space-y-2">
            {brief.evidence.map((evidence, index) => {
              const evidenceAmount = formatBriefMoney(evidence.amount);
              return (
                <li
                  key={`${evidence.kind}-${evidence.observed_on}-${index}`}
                  data-evidence-kind={evidence.kind}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-dark">{evidence.label}</p>
                    {evidence.note && <p className="text-neutral-mid">{evidence.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-neutral-mid">
                    {evidenceAmount && (
                      <span className="font-medium tabular-nums text-neutral-dark">
                        {evidenceAmount}
                      </span>
                    )}
                    <span>{formatDateLike(evidence.observed_on)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {brief.uncertainties && brief.uncertainties.length > 0 && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-uncertainties"
        >
          <h3 id="decision-brief-uncertainties" className="text-sm font-semibold text-neutral-dark">
            Información pendiente de confirmar
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-mid">
            {brief.uncertainties.map((uncertainty, index) => (
              <li key={`${uncertainty.kind}-${index}`}>{uncertainty.summary}</li>
            ))}
          </ul>
        </section>
      )}

      {brief.secondary_actions && brief.secondary_actions.length > 0 && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-audit"
        >
          <h3 id="decision-brief-audit" className="text-sm font-semibold text-neutral-dark">
            Revisión opcional de datos
          </h3>
          <p className="mt-1 text-sm text-neutral-mid">
            Esto no reemplaza la decisión que estás evaluando arriba.
          </p>
          <ul className="mt-2 space-y-2">
            {brief.secondary_actions.map((action) => (
              <li
                key={`${action.cta_href}-${action.title}`}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-neutral-dark">{action.title}</p>
                  <p className="text-neutral-mid">{action.description}</p>
                </div>
                <Link
                  href={action.cta_href}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                >
                  {action.cta_label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </QavanteCard>
  );
}

function AlternativeRow({
  alternative,
  recommended,
}: {
  alternative: BriefAlternative;
  recommended: boolean;
}) {
  return (
    <article
      data-alternative-id={alternative.alternative_id}
      className="rounded-lg border border-border bg-surface-muted/40 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-dark">{alternative.title}</h3>
            {recommended && <QavanteBadge variant="info">Recomendado</QavanteBadge>}
          </div>
          <p className="mt-1 text-sm text-neutral-mid">{alternative.description}</p>
        </div>
        {alternative.cta_href && alternative.cta_label && (
          <Link
            href={alternative.cta_href}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            {alternative.cta_label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {alternative.targets && alternative.targets.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/70 pt-2 text-sm text-neutral-mid">
          {alternative.targets.map((target, index) => {
            const targetAmount = formatBriefMoney(target.amount);
            return (
              <li key={`${target.target_kind}-${target.label}-${index}`}>
                <span className="font-medium text-neutral-dark">{target.label}</span>
                {targetAmount && <span> · {targetAmount}</span>}
                {target.due_by && <span> · {formatDateLike(target.due_by)}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {alternative.requires_human_confirmation && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-mid">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Requiere tu confirmación antes de realizar cualquier acción.
        </p>
      )}
    </article>
  );
}

function ProblemIcon({ state }: { state: CashDecisionBrief["state"] }) {
  if (state === "abstained") {
    return <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />;
  }
  if (state === "recommended") {
    return <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-700" aria-hidden="true" />;
  }
  return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-700" aria-hidden="true" />;
}

function Freshness({ freshness }: { freshness: CashDecisionBrief["freshness"] }) {
  const icon = <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;
  const tone =
    freshness.state === "current"
      ? "text-success-700"
      : freshness.state === "needs_update"
        ? "text-warning-700"
        : "text-neutral-mid";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      {icon}
      {freshness.summary}
    </span>
  );
}

/** La certeza llega enumerada desde el contrato; esto sólo la traduce para la interfaz. */
function Confidence({ confidence }: { confidence: CashDecisionBrief["confidence"] }) {
  const labels: Record<CashDecisionBrief["confidence"], string> = {
    high: "Alta",
    limited: "Limitada",
    unavailable: "No disponible",
  };

  return (
    <span data-decision-confidence={confidence} className="text-xs font-medium text-neutral-mid">
      Confianza: {labels[confidence]}
    </span>
  );
}

function formatBriefMoney(money: BriefMoney | null | undefined): string | null {
  if (!money || !money.currency.trim()) return null;
  return formatMoneyFromDecimalString(money.amount, money.currency);
}

function hasNonZeroAmount(money: BriefMoney | null | undefined): boolean {
  return money ? isNonZeroDecimalString(money.amount, money.currency) : false;
}

function isPositiveCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
