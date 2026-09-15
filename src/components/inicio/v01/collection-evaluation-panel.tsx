import { AlertTriangle, CircleDashed, HelpCircle, RefreshCw } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type { CollectionEvaluation, CollectionSituation } from "@/lib/api/collection-decisions";
import { cn } from "@/lib/utils";
import {
  collectionEvaluationView,
  type CollectionAlternativeState,
} from "./collection-evaluation-model";

export interface CollectionEvaluationPanelProps {
  situation: CollectionSituation | null;
  evaluation: CollectionEvaluation | null;
  loading?: boolean;
  error?: unknown;
  /** A canonical legal entity + currency + as-of are required by the published reader. */
  scopeAvailable?: boolean;
  onRetry?: () => void;
}

const ALTERNATIVE_LABEL: Record<CollectionAlternativeState, string> = {
  eligible: "Elegible",
  potentially_eligible: "Potencialmente elegible",
  ineligible: "No elegible",
  not_evaluable: "No evaluable",
};

const ALTERNATIVE_TONE: Record<
  CollectionAlternativeState,
  "default" | "info" | "warning" | "success"
> = {
  eligible: "success",
  potentially_eligible: "info",
  ineligible: "default",
  not_evaluable: "warning",
};

/**
 * Shared V01 read-only surface for F3. It transports reader states explicitly and deliberately
 * has no select, approval, reminder or payment action.
 */
export function CollectionEvaluationPanel({
  situation,
  evaluation,
  loading = false,
  error = null,
  scopeAvailable = true,
  onRetry,
}: CollectionEvaluationPanelProps) {
  if (!scopeAvailable) {
    return (
      <QavanteCard variant="bordered">
        <section aria-labelledby="collection-evaluation-title" className="flex items-start gap-3">
          <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Decisión de cobranza
            </p>
            <h3 id="collection-evaluation-title" className="mt-1 font-semibold text-neutral-dark">
              Contexto de entidad requerido
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">
              El contrato F3 requiere entidad legal, moneda y fecha de corte. Esta pantalla no
              infiere la entidad desde el tenant ni consulta el reader hasta contar con ese
              contexto.
            </p>
          </div>
        </section>
      </QavanteCard>
    );
  }

  if (loading) {
    return (
      <section aria-label="Evaluación de cobranza" aria-busy="true" className="space-y-2">
        <p role="status" className="text-sm text-neutral-mid">
          Buscando la situación y evaluación de cobranza…
        </p>
        <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" aria-hidden="true" />
      </section>
    );
  }

  if (error) {
    return (
      <QavanteCard variant="bordered">
        <section
          aria-labelledby="collection-evaluation-title"
          role="alert"
          className="flex items-start gap-3"
        >
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <h3 id="collection-evaluation-title" className="font-semibold text-neutral-dark">
              No pudimos leer la evaluación de cobranza
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">
              No mostraremos alternativas ni asumiremos importes mientras no recuperemos el
              snapshot.
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-brand-primary/40 px-3 py-1.5 text-xs font-semibold text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Reintentar
              </button>
            )}
          </div>
        </section>
      </QavanteCard>
    );
  }

  if (!evaluation) {
    return (
      <QavanteCard variant="bordered">
        <section aria-labelledby="collection-evaluation-title" className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Decisión de cobranza
            </p>
            <h3 id="collection-evaluation-title" className="mt-1 font-semibold text-neutral-dark">
              Aún no hay una evaluación disponible
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">
              Cuando exista un snapshot evaluable, esta vista mostrará su estado sin fabricar una
              recomendación.
            </p>
          </div>
        </section>
      </QavanteCard>
    );
  }

  const view = collectionEvaluationView(evaluation, situation);
  return (
    <section aria-labelledby="collection-evaluation-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Decisión de cobranza
          </p>
          <h3
            id="collection-evaluation-title"
            className="mt-1 text-lg font-semibold text-neutral-dark"
          >
            {view.stateLabel}
          </h3>
          <p className="mt-1 text-sm text-neutral-mid">{view.stateDescription}</p>
        </div>
        <QavanteBadge variant={view.freshness === "fresh" ? "success" : "warning"}>
          {view.freshnessLabel}
        </QavanteBadge>
      </div>

      {view.state === "abstained" && (
        <QavanteCard variant="bordered" className="border-warning-500/40 bg-warning-50">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning-700"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-neutral-dark">No hay recomendación de cobranza</p>
              <p className="mt-1 text-sm text-neutral-mid">
                No hay evidencia suficiente para formular una sugerencia.
              </p>
              <ReasonList label="Motivos de abstención" reasons={view.abstainReasons} />
            </div>
          </div>
        </QavanteCard>
      )}

      {view.situationState === "abstained" && (
        <QavanteCard variant="bordered" className="border-warning-500/40 bg-warning-50">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning-700"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-neutral-dark">Situación de cobranza no informada</p>
              <p className="mt-1 text-sm text-neutral-mid">
                No recibimos documentos para este alcance y no los representamos como cero.
              </p>
              <ReasonList
                label="Motivos de abstención de la situación"
                reasons={view.situationAbstainReasons}
              />
            </div>
          </div>
        </QavanteCard>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Detail
          label="Documentos por cobrar"
          value={view.receivables === null ? "No informado" : String(view.receivables)}
        />
        <Detail
          label="Documentos por pagar"
          value={view.payables === null ? "No informado" : String(view.payables)}
        />
        <Detail label="Fecha de corte" value={view.asOfLabel} />
      </div>

      {view.subjects.length > 0 && (
        <ul className="space-y-3" aria-label="Evaluaciones por documento">
          {view.subjects.map((subject) => (
            <li key={subject.id}>
              <QavanteCard variant="bordered">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                  {subject.subjectKind === "receivable" ? "Por cobrar" : "Por pagar"}
                </p>
                <p className="mt-1 break-all font-semibold text-neutral-dark">
                  {subject.subjectRef}
                </p>
                <p className="mt-1 text-sm text-neutral-mid">
                  {subject.state === "ready"
                    ? "Evaluación disponible"
                    : subject.state === "observed_only"
                      ? "Sólo observado: sin alternativa evaluada"
                      : "Evaluación abstendida"}
                </p>
                <ReasonList label="Motivos informados" reasons={subject.reasons} />
                {subject.alternatives.length > 0 && (
                  <ul
                    className="mt-3 space-y-2"
                    aria-label={`Alternativas para ${subject.subjectRef}`}
                  >
                    {subject.alternatives.map((alternative) => (
                      <li
                        key={`${subject.id}:${alternative.code}`}
                        className="rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="break-all text-sm font-semibold text-neutral-dark">
                            {alternative.code}
                          </p>
                          <QavanteBadge variant={ALTERNATIVE_TONE[alternative.state]}>
                            {ALTERNATIVE_LABEL[alternative.state]}
                          </QavanteBadge>
                        </div>
                        {alternative.state === "not_evaluable" && (
                          <p className="mt-1 text-xs text-warning-700">
                            Esta alternativa no es evaluable con la evidencia actual.
                          </p>
                        )}
                        <ReasonList
                          label="Causas contractuales"
                          reasons={alternative.reasonCodes}
                        />
                        {alternative.evidenceRefs.length > 0 && (
                          <p className="mt-2 text-xs text-neutral-mid">
                            {alternative.evidenceRefs.length} referencia
                            {alternative.evidenceRefs.length === 1 ? "" : "s"} de evidencia
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </QavanteCard>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-mid">
        Snapshot al {view.asOfLabel} · {view.sourceRefs.length} fuente
        {view.sourceRefs.length === 1 ? "" : "s"} informada
        {view.sourceRefs.length === 1 ? "" : "s"}. Esta vista es sólo lectura y no ejecuta cobranzas
        ni reprogramaciones.
      </p>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <QavanteCard variant="bordered">
      <dl>
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          {label}
        </dt>
        <dd className="mt-1.5 text-lg font-bold tabular-nums text-neutral-dark">{value}</dd>
      </dl>
    </QavanteCard>
  );
}

function ReasonList({ label, reasons }: { label: string; reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className={cn("mt-3 border-t border-neutral-light/60 pt-3")}>
      <p className="text-xs font-semibold text-neutral-dark">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-neutral-mid">
        {reasons.map((reason) => (
          <li key={reason} className="break-all font-mono">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
