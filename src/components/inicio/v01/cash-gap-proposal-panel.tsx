import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { normalizeVisibleText } from "@/lib/formatters/visible-text";
import type { CashGapProposal } from "./cash-gap-proposal-model";

function confidenceLabel(value: CashGapProposal["confidence"]): string {
  return {
    high: "Confianza alta",
    medium: "Confianza media",
    low: "Confianza baja",
    preliminary: "Confianza preliminar",
  }[value];
}

function impactLabel(metric: string, horizonDays: number | null | undefined): string {
  if (metric === "cash_gap_14d") return "Brecha de caja a 14 días";
  return horizonDays != null ? `Impacto publicado a ${horizonDays} días` : "Impacto publicado";
}

function amount(value: string, currency: string | null | undefined): string | null {
  if (!currency?.trim()) return null;
  const parsed = parseAmountOrNull(value);
  return parsed == null ? null : formatMoney(parsed, currency);
}

/**
 * Muestra una propuesta ya evaluada por el backend. No combina sus montos ni transforma
 * alternativas en una recomendación nueva: cada plan mantiene su evidencia y CTA propios.
 */
export function CashGapProposalPanel({
  proposals,
  loading,
}: {
  proposals: readonly CashGapProposal[];
  loading: boolean;
}) {
  if (!loading && proposals.length === 0) return null;

  return (
    <section aria-labelledby="propuesta-caja" className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Decisión de hoy
        </p>
        <h3 id="propuesta-caja" className="mt-1 text-lg font-semibold text-neutral-dark">
          Propuesta para proteger tu caja
        </h3>
        <p className="mt-1 text-sm text-neutral-mid">
          Qavante prioriza alternativas con evidencia publicada. Tú las revisas antes de actuar.
        </p>
      </div>

      {loading && proposals.length === 0 ? (
        <QavanteCard variant="bordered">
          <p role="status" className="text-sm text-neutral-mid">
            Preparando propuestas de pagos y cobranza con tus datos vigentes (~5 s).
          </p>
        </QavanteCard>
      ) : (
        <ul className="space-y-3" aria-label="Propuestas verificadas de Qavante">
          {proposals.map((proposal) => (
            <li key={proposal.kind}>
              <QavanteCard variant="bordered">
                <article className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                        {proposal.kind === "payment_plan" ? "Pagos" : "Cobranza"}
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-neutral-dark">
                        {normalizeVisibleText(proposal.label)}
                      </h4>
                      <p className="mt-1 text-sm text-neutral-mid">
                        {normalizeVisibleText(proposal.explanation)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {confidenceLabel(proposal.confidence)}
                    </span>
                  </div>

                  {proposal.impacts.length > 0 && (
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {proposal.impacts.map((impact, index) => {
                        const value = amount(impact.value, impact.currency);
                        return (
                          <div
                            key={`${impact.metric}-${index}`}
                            className="rounded-lg bg-neutral-light/40 p-3"
                          >
                            <dt className="text-xs font-medium text-neutral-mid">
                              {impactLabel(impact.metric, impact.horizon_days)}
                            </dt>
                            <dd className="mt-1 font-semibold tabular-nums text-neutral-dark">
                              {value ?? "Sin monto publicable"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}

                  {proposal.targets.length > 0 && (
                    <div className="rounded-lg border border-border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                        Qué revisar primero
                      </p>
                      <ul className="mt-2 space-y-1.5 text-sm text-neutral-mid">
                        {proposal.targets.map((target, index) => (
                          <li key={`${target.label}-${index}`}>
                            <span className="font-medium text-neutral-dark">
                              {normalizeVisibleText(target.label)}
                            </span>
                            <span> · {normalizeVisibleText(target.reason)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-neutral-mid">
                      {proposal.evidenceCount === 0
                        ? "Sin evidencia detallada publicada"
                        : `${proposal.evidenceCount} evidencia${proposal.evidenceCount === 1 ? "" : "s"} publicada${proposal.evidenceCount === 1 ? "" : "s"}`}
                    </p>
                    <Link
                      href={proposal.href}
                      className="group inline-flex items-center gap-1 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                    >
                      {proposal.cta}
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                  {proposal.caveats.length > 0 && (
                    <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-sm text-neutral-mid">
                      <p className="font-medium text-neutral-dark">Antes de actuar</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {proposal.caveats.map((caveat) => (
                          <li key={caveat}>{normalizeVisibleText(caveat)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              </QavanteCard>
            </li>
          ))}
          {loading && (
            <li className="text-sm text-neutral-mid" role="status">
              Completando la lectura de la otra alternativa (~5 s).
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
