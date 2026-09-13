"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileWarning } from "lucide-react";
import { useCashDecisionBrief, type CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { ApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/formatters/clp";

export function withDecisionContext(href: string, brief: CashDecisionBrief) {
  const url = new URL(href, "https://qavante.local");
  url.searchParams.set("decision_id", brief.decision_id);
  url.searchParams.set("context_hash", brief.context_hash);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Los CTA del brief sólo navegan a un plan o una recuperación de fuentes; nunca ejecutan una acción. */
export function shouldRenderDecisionCta(alternative: {
  cta_href?: string | null;
  cta_label?: string | null;
}) {
  return Boolean(alternative.cta_href && alternative.cta_label);
}

/** El endpoint puede no estar disponible durante una actualización gradual; sólo ese 404 se omite. */
export function shouldOmitDecisionBrief(error: unknown) {
  return error instanceof ApiError && error.isNotFound();
}

function money(value: { amount: string; currency: string; label: string } | null | undefined) {
  if (!value) return null;
  const amount = Number(value.amount);
  return `${value.label}: ${Number.isFinite(amount) ? formatMoney(amount, value.currency) : value.amount}`;
}

/**
 * Capa de lectura común para Inicio, Caja, Pagar, Cobrar y Bandeja.
 * No calcula brechas, no ordena alternativas y no convierte monedas: eso pertenece al brief API.
 */
export function CashDecisionBriefCard() {
  const query = useCashDecisionBrief();

  if (query.isLoading) return null;
  if (query.isError) {
    if (shouldOmitDecisionBrief(query.error)) return null;
    return (
      <section
        aria-label="Decisión de caja no disponible"
        role="alert"
        aria-live="assertive"
        className="rounded-xl border border-warning-300 bg-warning-50 px-5 py-4 text-sm text-neutral-dark"
      >
        <p className="font-semibold">No pudimos actualizar la decisión de caja.</p>
        <p className="mt-1 text-neutral-mid">
          No mostraremos una recomendación alternativa hasta recuperar la respuesta del servidor.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="mt-3 rounded-lg border border-brand-primary px-3 py-2 font-semibold text-brand-primary hover:bg-brand-primary-50 disabled:cursor-wait disabled:opacity-60"
        >
          {query.isFetching ? "Reintentando…" : "Reintentar"}
        </button>
      </section>
    );
  }
  if (!query.data) return null;
  const brief = query.data;
  const recommended = brief.alternatives.find(
    (alternative) => alternative.alternative_id === brief.recommended_alternative_id,
  );
  if (!recommended) return null;

  const isAbstained = brief.state === "abstained" || recommended.state === "not_evaluable";
  const alternatives = brief.alternatives.filter(
    (alternative) => alternative.alternative_id !== recommended.alternative_id,
  );

  return (
    <section
      aria-labelledby="cash-decision-brief-title"
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="border-b border-border bg-brand-primary-50/50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-primary">
          Decisión de caja
        </p>
        <h2 id="cash-decision-brief-title" className="mt-1 text-lg font-semibold text-neutral-dark">
          {brief.problem.title}
        </h2>
        <p className="mt-1 text-sm text-neutral-mid">{brief.problem.summary}</p>
        {money(brief.problem.amount) && (
          <p className="mt-2 font-semibold tabular-nums text-neutral-dark">
            {money(brief.problem.amount)}
          </p>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex gap-3">
          {isAbstained ? (
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-700" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold text-neutral-dark">{recommended.title}</p>
            <p className="mt-0.5 text-sm text-neutral-mid">{recommended.description}</p>
            {recommended.targets?.map((target) => (
              <p
                key={`${target.target_kind}-${target.label}`}
                className="mt-1 text-sm text-neutral-dark"
              >
                {money(target.amount) ?? target.label}
                {target.due_by ? ` · hasta ${target.due_by}` : ""}
              </p>
            ))}
            {recommended.cta_href && recommended.cta_label && (
              <Link
                href={withDecisionContext(recommended.cta_href, brief)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {recommended.cta_label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {alternatives.length > 0 && (
          <details className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-neutral-dark">
              Ver alternativas
            </summary>
            <ul className="mt-2 space-y-2 text-sm text-neutral-mid">
              {alternatives.map((alternative) => (
                <li key={alternative.alternative_id}>
                  <span className="font-medium text-neutral-dark">{alternative.title}:</span>{" "}
                  {alternative.description}
                  {shouldRenderDecisionCta(alternative) && (
                    <Link
                      href={withDecisionContext(alternative.cta_href!, brief)}
                      className="ml-1 font-medium text-brand-primary hover:underline"
                    >
                      {alternative.cta_label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="grid gap-2 text-xs text-neutral-mid sm:grid-cols-2">
          <p className="flex gap-1.5">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {brief.freshness.summary}
          </p>
          <p>Cobertura: {brief.coverage.summary}</p>
          {brief.evidence?.map((item) => (
            <p key={`${item.kind}-${item.label}`}>
              Fuente: {item.label}
              {item.note ? ` · ${item.note}` : ""}
            </p>
          ))}
        </div>

        {brief.uncertainties && brief.uncertainties.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-warning-100 px-3 py-2 text-sm text-neutral-dark">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-warning-700"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">Lo que puede cambiar esta recomendación</p>
              <ul className="mt-1 list-disc pl-4 text-neutral-mid">
                {brief.uncertainties.map((uncertainty) => (
                  <li key={uncertainty.summary}>{uncertainty.summary}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {brief.secondary_actions && brief.secondary_actions.length > 0 && (
        <div className="border-t border-border px-5 py-3 text-sm text-neutral-mid">
          <p className="font-medium text-neutral-dark">Auditoría opcional</p>
          {brief.secondary_actions.map((action) => (
            <Link
              key={action.cta_href}
              href={withDecisionContext(action.cta_href, brief)}
              className="mt-1 inline-block text-brand-primary hover:underline"
            >
              {action.cta_label}: {action.description}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
