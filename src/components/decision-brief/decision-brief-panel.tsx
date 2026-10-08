import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, ShieldAlert } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { formatMoneyFromDecimalString, isNonZeroDecimalString } from "@/lib/formatters/clp";
import { formatCount } from "@/lib/formatters/count";
import { formatDateLike } from "@/lib/formatters/date";

type BriefAlternative = CashDecisionBrief["alternatives"][number];
type BriefMoney = NonNullable<CashDecisionBrief["problem"]["amount"]>;
type BriefConfidence = CashDecisionBrief["confidence"];
type BriefUncertainty = NonNullable<CashDecisionBrief["uncertainties"]>[number];
type BriefSecondaryAction = NonNullable<CashDecisionBrief["secondary_actions"]>[number];

/**
 * Presentación literal del contrato de decisión. Este componente no decide qué
 * mostrar: conserva el orden, los ids y los CTA que recibió del servidor.
 */
export function DecisionBriefPanel({ brief }: { brief: CashDecisionBrief }) {
  const amount = formatBriefMoney(brief.problem.amount);
  const recommended =
    brief.alternatives.find(
      (alternative) => alternative.alternative_id === brief.recommended_alternative_id,
    ) ?? brief.alternatives[0];
  const otherAlternatives = brief.alternatives.filter(
    (alternative) => alternative.alternative_id !== recommended?.alternative_id,
  );
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
  const confidenceNote = describeConfidence(brief.confidence);
  const evidence = brief.evidence ?? [];
  const uncertainties = brief.uncertainties ?? [];
  const secondaryActions = brief.secondary_actions ?? [];

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
          {brief.freshness.state !== "current" && (
            <span className="text-xs font-medium text-warning-700">Actualizar datos</span>
          )}
        </div>
      }
    >
      <p className="text-xs text-neutral-mid">{brief.freshness.summary}</p>

      <section aria-labelledby="decision-brief-problem" className="mt-2 space-y-2">
        <div className="flex items-start gap-2.5">
          <ProblemIcon state={brief.state} />
          <div className="min-w-0">
            <h2 id="decision-brief-problem" className="text-lg font-semibold text-neutral-dark">
              {brief.problem.title}
            </h2>
            {brief.problem.summary && (
              <p className="mt-1 text-sm text-neutral-mid">{brief.problem.summary}</p>
            )}
            {amount && (
              <p className="mt-2 font-semibold tabular-nums text-neutral-dark">{amount}</p>
            )}
            {confidenceNote && <p className="mt-1 text-sm text-neutral-mid">{confidenceNote}</p>}
          </div>
        </div>
      </section>

      {recommended && (
        <section
          aria-label="Acción recomendada"
          className="mt-4 space-y-3 border-t border-border pt-4"
        >
          <AlternativeRow
            alternative={recommended}
            recommended={recommended.alternative_id === brief.recommended_alternative_id}
          />
        </section>
      )}

      {otherAlternatives.length > 0 && (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-primary">
            Ver otras opciones ({otherAlternatives.length})
          </summary>
          <div className="mt-3 space-y-2">
            {otherAlternatives.map((alternative) => (
              <AlternativeRow
                key={alternative.alternative_id}
                alternative={alternative}
                recommended={false}
              />
            ))}
          </div>
        </details>
      )}

      {hasCoverageImpact && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-coverage-impact"
        >
          <h3
            id="decision-brief-coverage-impact"
            className="text-sm font-semibold text-neutral-dark"
          >
            Datos pendientes
          </h3>
          <ul className="mt-1 space-y-1 text-sm text-neutral-mid">
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

      {evidence.length > 0 && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-evidence"
        >
          <h3 id="decision-brief-evidence" className="text-sm font-semibold text-neutral-dark">
            Evidencia
          </h3>
          <ul className="mt-1 space-y-1 text-sm text-neutral-mid">
            {evidence.map((item, index) => {
              const evidenceAmount = formatBriefMoney(item.amount);
              return (
                <li key={`${item.kind}-${index}`}>
                  <span className="font-medium text-neutral-dark">{item.label}</span>
                  {evidenceAmount && (
                    <span className="tabular-nums text-neutral-dark"> · {evidenceAmount}</span>
                  )}
                  {item.note && <span> · {item.note}</span>}
                  <span className="text-xs"> · {formatDateLike(item.observed_on)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {uncertainties.length > 0 && (
        <section
          className="mt-4 border-t border-border pt-3"
          aria-labelledby="decision-brief-uncertainty"
        >
          <h3 id="decision-brief-uncertainty" className="text-sm font-semibold text-neutral-dark">
            Incertidumbre declarada
          </h3>
          <ul className="mt-1 space-y-1 text-sm text-neutral-mid">
            {uncertainties.map((item: BriefUncertainty, index) => (
              <li
                key={`${item.kind}-${index}`}
                className={item.blocks_recommendation ? "font-medium text-warning-700" : undefined}
              >
                {item.summary}
                {isPositiveCount(item.item_count) && <span> ({formatCount(item.item_count)})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {secondaryActions.length > 0 && (
        <details
          className="mt-3 border-t border-border pt-3"
          data-testid="decision-brief-secondary-actions"
        >
          <summary className="cursor-pointer text-sm font-medium text-neutral-mid">
            Otras herramientas
          </summary>
          <div className="mt-2 space-y-2">
            {secondaryActions.map((action, index) => (
              <SecondaryActionRow key={`${action.decision_kind}-${index}`} action={action} />
            ))}
          </div>
        </details>
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
      className={
        alternative.state === "not_evaluable"
          ? "rounded-lg border border-border bg-surface-muted/40 p-3 opacity-70"
          : "rounded-lg border border-border bg-surface-muted/40 p-3"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-dark">{alternative.title}</h3>
            {recommended && <QavanteBadge variant="info">Recomendado</QavanteBadge>}
            {alternative.requires_human_confirmation && (
              <QavanteBadge variant="default">Confirmación manual</QavanteBadge>
            )}
            {alternative.state === "not_evaluable" && (
              <QavanteBadge variant="default">No evaluable ahora</QavanteBadge>
            )}
          </div>
          {alternative.description && (
            <p className="mt-1 text-sm text-neutral-mid">{alternative.description}</p>
          )}
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
    </article>
  );
}

function SecondaryActionRow({ action }: { action: BriefSecondaryAction }) {
  return (
    <article className="rounded-lg border border-border/70 p-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-neutral-dark">{action.title}</h4>
          <p className="mt-1 text-sm text-neutral-mid">{action.description}</p>
        </div>
        <Link
          href={action.cta_href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          {action.cta_label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

/* Nunca usa la palabra "confianza" ni "preliminar" (regla de copy del producto):
   describe qué cubre la evaluación en vez de calificarla. "high" no agrega
   texto porque es el caso esperado y no necesita aclaración adicional. */
function describeConfidence(confidence: BriefConfidence): string | null {
  if (confidence === "limited") {
    return "Esta evaluación usa evidencia parcial.";
  }
  if (confidence === "unavailable") {
    return "No hay evidencia suficiente para calcular esta evaluación.";
  }
  return null;
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
