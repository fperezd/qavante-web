import { FileSearch, ShieldCheck } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type {
  FxEvaluationRead,
  FxExposureRead,
  InvestmentEvaluationRead,
  InvestableSurplusRead,
  LearningCandidateRead,
  OutcomeValueRead,
  SourceFreshnessRead,
} from "@/lib/api/financial-decision-readers";
import {
  learningKindLabel,
  learningReasonLabel,
  uniqueReferences,
} from "./learning-candidates-model";
import { freshnessReasonLabel, freshnessStateLabel } from "./source-freshness-model";
import {
  itemCount,
  itemSummary,
  outcomeDecisionView,
  type OutcomeDecisionView,
  type ReaderCollection,
  type ReaderResponse,
} from "./decision-read-model";

/* F10 is deliberately not an "abstained" reader: its contract publishes
   `not_evaluable`. Keep the generic closed over the two server contracts used
   by this panel so an arbitrary `{ state: string }` cannot enter the view. */
interface ReaderState<T extends ReaderResponse | LearningCandidateRead | SourceFreshnessRead> {
  data?: T;
  loading: boolean;
  failed: boolean;
}

export interface DecisionReadersView {
  fxExposures: ReaderState<FxExposureRead>;
  fxEvaluations: ReaderState<FxEvaluationRead>;
  investableSurplus: ReaderState<InvestableSurplusRead>;
  investmentEvaluations: ReaderState<InvestmentEvaluationRead>;
  outcomeValues: ReaderState<OutcomeValueRead>;
  learningCandidates: ReaderState<LearningCandidateRead>;
  sourceFreshness: ReaderState<SourceFreshnessRead>;
}

export function DecisionReadPanel({ readers }: { readers: DecisionReadersView }) {
  return (
    <section aria-labelledby="decision-readers-title" className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Decision OS · sólo lectura
        </p>
        <h3 id="decision-readers-title" className="mt-1 text-lg font-semibold text-neutral-dark">
          Exposición, excedentes y resultados
        </h3>
        <p className="mt-1 text-sm text-neutral-mid">
          Lecturas acotadas a la entidad, moneda y fecha publicadas. No crean ni seleccionan
          operaciones.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Lecturas del Decision OS">
        <li>
          <ReaderCard
            title="FX · exposiciones"
            data={readers.fxExposures.data}
            loading={readers.fxExposures.loading}
            failed={readers.fxExposures.failed}
            itemLabel="exposición"
            itemLabelPlural="exposiciones"
            collection="exposures"
          />
        </li>
        <li>
          <ReaderCard
            title="FX · evaluaciones"
            data={readers.fxEvaluations.data}
            loading={readers.fxEvaluations.loading}
            failed={readers.fxEvaluations.failed}
            itemLabel="evaluación"
            itemLabelPlural="evaluaciones"
            collection="evaluations"
          />
        </li>
        <li>
          <ReaderCard
            title="Inversión · excedente disponible"
            data={readers.investableSurplus.data}
            loading={readers.investableSurplus.loading}
            failed={readers.investableSurplus.failed}
            itemLabel="producto"
            itemLabelPlural="productos"
            collection="products"
          />
        </li>
        <li>
          <ReaderCard
            title="Inversión · evaluaciones"
            data={readers.investmentEvaluations.data}
            loading={readers.investmentEvaluations.loading}
            failed={readers.investmentEvaluations.failed}
            itemLabel="evaluación"
            itemLabelPlural="evaluaciones"
            collection="evaluations"
          />
        </li>
      </ul>
      <ReaderCard
        title="F9 · resultados y valor"
        data={readers.outcomeValues.data}
        loading={readers.outcomeValues.loading}
        failed={readers.outcomeValues.failed}
        itemLabel="resultado"
        itemLabelPlural="resultados"
        collection="outcomes"
        outcomeDetails={readers.outcomeValues.data?.outcomes}
        outcomeCurrency={readers.outcomeValues.data?.scope.currency}
      />
      <LearningCandidatesCard state={readers.learningCandidates} />
      <SourceFreshnessCard state={readers.sourceFreshness} />
    </section>
  );
}

function SourceFreshnessCard({ state }: { state: ReaderState<SourceFreshnessRead> }) {
  const data = state.data;
  const summary = data?.freshness_summary;
  const notEvaluable = summary?.state === "not_evaluable";
  const metrics = data?.freshness_metrics ?? [];

  return (
    <QavanteCard variant="bordered">
      <article aria-label="F10 · frescura de fuentes">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-neutral-dark">F10 · frescura de fuentes</h4>
            <p className="mt-1 text-sm text-neutral-mid">
              Lectura según la política publicada; sus reglas no se ajustan desde aquí.
            </p>
          </div>
          <StateBadge loading={state.loading} failed={state.failed} abstained={notEvaluable} />
        </div>

        {state.loading ? (
          <p className="mt-3 text-sm text-neutral-mid">Consultando la frescura publicada…</p>
        ) : state.failed ? (
          <p className="mt-3 text-sm text-neutral-mid">
            No fue posible verificar la frescura de las fuentes.
          </p>
        ) : !data || !summary ? (
          <p className="mt-3 text-sm text-neutral-mid">Sin lectura publicada.</p>
        ) : notEvaluable ? (
          <p className="mt-3 text-sm text-neutral-mid">
            Sin dato · {freshnessReasonLabel(summary.reason_codes)}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-mid">
              Fuentes vigentes: {summary.fresh_sources ?? "Sin dato"} de{" "}
              {summary.required_sources ?? "Sin dato"}.
            </p>
            {metrics.length > 0 && (
              <ul className="mt-4 space-y-3 border-t border-neutral-light/60 pt-3">
                {metrics.map((metric) => (
                  <li
                    key={metric.source_code}
                    className="rounded-lg border border-neutral-light/70 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-neutral-dark">{metric.source_code}</p>
                      <QavanteBadge variant={metric.state === "fresh" ? "success" : "warning"}>
                        {freshnessStateLabel(metric.state)}
                      </QavanteBadge>
                    </div>
                    {metric.metric_state === "not_evaluable" ? (
                      <p className="mt-2 text-xs text-neutral-mid">
                        Sin dato · {freshnessReasonLabel(metric.reason_codes)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-mid">
                        Edad publicada: {metric.age_ms ?? "Sin dato"} ms
                      </p>
                    )}
                    <TraceList label="Evidencia" refs={metric.evidence_refs ?? []} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {data && (
          <section className="mt-4 border-t border-neutral-light/60 pt-3 text-xs text-neutral-mid">
            <p>
              Alcance publicado: entidad{" "}
              <span className="font-mono">{data.scope.legal_entity_id}</span>
              {" · "}
              {data.scope.currency} · corte {data.scope.as_of}
            </p>
            {data.policy && (
              <p className="mt-2">
                Política: <span className="font-mono">{data.scope.policy_code}</span> · versión{" "}
                <span className="font-mono">{data.policy.version}</span> · reglas{" "}
                <span className="break-all font-mono">{data.policy.rules_ref}</span>
              </p>
            )}
            <TraceList label="Linaje" refs={data.source_refs} />
            {data.snapshot_ref && (
              <p className="mt-3 break-all font-mono">Snapshot: {data.snapshot_ref}</p>
            )}
          </section>
        )}
      </article>
    </QavanteCard>
  );
}

function LearningCandidatesCard({ state }: { state: ReaderState<LearningCandidateRead> }) {
  const data = state.data;
  const signals = data?.signals ?? [];

  return (
    <QavanteCard variant="bordered">
      <article aria-label="F10 · señales candidatas de aprendizaje">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-neutral-dark">F10 · señales candidatas</h4>
            <p className="mt-1 text-sm text-neutral-mid">
              Observaciones para revisión: no modifican políticas ni proyecciones.
            </p>
          </div>
          <StateBadge
            loading={state.loading}
            failed={state.failed}
            abstained={data?.state === "not_evaluable"}
          />
        </div>

        {state.loading ? (
          <p className="mt-3 text-sm text-neutral-mid">Consultando las señales publicadas…</p>
        ) : state.failed ? (
          <p className="mt-3 text-sm text-neutral-mid">
            No fue posible verificar las señales candidatas.
          </p>
        ) : !data ? (
          <p className="mt-3 text-sm text-neutral-mid">Sin lectura publicada.</p>
        ) : data.state === "not_evaluable" ? (
          <p className="mt-3 text-sm text-neutral-mid">
            Sin dato · {learningReasonLabel(data.reasons)}
          </p>
        ) : signals.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-mid">
            Sin señales candidatas en este snapshot publicado.
          </p>
        ) : (
          <ul className="mt-4 space-y-3 border-t border-neutral-light/60 pt-3">
            {signals.map((signal) => (
              <li
                key={`${signal.kind}-${signal.subject_ref}`}
                className="rounded-lg border border-neutral-light/70 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-dark">
                      {learningKindLabel(signal.kind)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-mid">
                      Decisión o sujeto: <span className="font-mono">{signal.subject_ref}</span>
                    </p>
                  </div>
                  <QavanteBadge variant="info">Sólo candidata</QavanteBadge>
                </div>
                <TraceList label="Evidencia" refs={signal.evidence_refs} />
              </li>
            ))}
          </ul>
        )}

        {data && (
          <section className="mt-4 border-t border-neutral-light/60 pt-3 text-xs text-neutral-mid">
            <p>
              Alcance publicado: entidad{" "}
              <span className="font-mono">{data.scope.legal_entity_id}</span>
              {" · "}
              {data.scope.currency} · corte {data.scope.as_of}
            </p>
            <TraceList label="Linaje" refs={uniqueReferences([data.source_refs])} />
            {data.source_snapshot_hash && (
              <p className="mt-3 break-all font-mono">Snapshot: {data.source_snapshot_hash}</p>
            )}
          </section>
        )}
      </article>
    </QavanteCard>
  );
}

function ReaderCard({
  title,
  data,
  loading,
  failed,
  itemLabel,
  itemLabelPlural,
  collection,
  outcomeDetails,
  outcomeCurrency,
}: {
  title: string;
  data: ReaderResponse | undefined;
  loading: boolean;
  failed: boolean;
  itemLabel: string;
  itemLabelPlural: string;
  collection: ReaderCollection;
  outcomeDetails?: OutcomeValueRead["outcomes"];
  outcomeCurrency?: string;
}) {
  const items = itemCount(data, collection);
  const abstained = data?.state === "abstained";
  return (
    <QavanteCard variant="bordered" className="h-full">
      <article aria-label={title}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h4 className="font-semibold text-neutral-dark">{title}</h4>
          <StateBadge loading={loading} failed={failed} abstained={abstained} />
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-mid">Consultando el snapshot publicado…</p>
        ) : failed ? (
          <p className="mt-3 text-sm text-neutral-mid">No fue posible verificar esta lectura.</p>
        ) : data ? (
          <>
            <p className="mt-3 text-sm text-neutral-mid">
              {abstained
                ? "No evaluable con la evidencia disponible."
                : itemSummary(items, itemLabel, itemLabelPlural)}
            </p>
            <Provenance data={data} />
            {outcomeDetails && outcomeDetails.length > 0 && outcomeCurrency && (
              <ul className="mt-4 space-y-3 border-t border-neutral-light/60 pt-3">
                {outcomeDetails.map((outcome) => (
                  <li key={outcome.outcome_ref}>
                    <OutcomeDecisionCard view={outcomeDecisionView(outcome, outcomeCurrency)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-mid">Sin lectura publicada.</p>
        )}
      </article>
    </QavanteCard>
  );
}

function OutcomeDecisionCard({ view }: { view: OutcomeDecisionView }) {
  return (
    <article
      aria-label={`Resultado de la decisión ${view.decisionRef}`}
      className="rounded-lg border border-neutral-light/70 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Decisión {view.decisionRef}
          </p>
          <h5 className="mt-1 font-semibold text-neutral-dark">{view.alternative}</h5>
          <p className="mt-1 text-xs text-neutral-mid">Estado operativo: {view.operationalState}</p>
        </div>
        <QavanteBadge variant={view.valueLedgerState === "observed" ? "success" : "warning"}>
          {view.valueLedgerState === "observed"
            ? "Valor medido"
            : view.valueLedgerState === "partial"
              ? "Medición parcial"
              : "No evaluable"}
        </QavanteBadge>
      </div>

      <div className="mt-4 rounded-lg bg-neutral-light/20 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Valor atribuido
        </p>
        <p className="mt-1 text-lg font-semibold text-neutral-dark">{view.attributedValue}</p>
        {view.attributionLabel && (
          <p className="mt-1 text-xs text-neutral-mid">{view.attributionLabel}</p>
        )}
      </div>

      <OutcomeFieldGroup title="Resultado observado" fields={view.assessmentFields} />
      {view.ledgerFields.length > 0 && (
        <OutcomeFieldGroup title="Desglose del valor" fields={view.ledgerFields} />
      )}
      <OutcomeFieldGroup title="Error de proyección" fields={view.projectionFields} />
      <OutcomeFieldGroup title="Cotización versus resultado" fields={view.quoteFields} />

      {view.limitations.length > 0 && (
        <p className="mt-3 text-xs text-neutral-mid">
          Motivos y límites: {view.limitations.join(", ")}
        </p>
      )}
      {view.traceGroups.some(
        (group) => group.evidenceRefs.length > 0 || group.lineageRefs.length > 0,
      ) && (
        <section className="mt-4" aria-label="Trazabilidad por medición">
          <h6 className="text-xs font-semibold text-neutral-dark">Trazabilidad por medición</h6>
          <ul className="mt-2 space-y-3">
            {view.traceGroups.map((group) =>
              group.evidenceRefs.length > 0 || group.lineageRefs.length > 0 ? (
                <li key={group.key} className="rounded-md border border-neutral-light/60 p-3">
                  <p className="text-xs font-semibold text-neutral-dark">{group.label}</p>
                  <TraceList label="Evidencia" refs={group.evidenceRefs} />
                  <TraceList label="Linaje" refs={group.lineageRefs} />
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}
    </article>
  );
}

function OutcomeFieldGroup({
  title,
  fields,
}: {
  title: string;
  fields: OutcomeDecisionView["assessmentFields"];
}) {
  return (
    <section className="mt-4" aria-label={title}>
      <h6 className="text-xs font-semibold text-neutral-dark">{title}</h6>
      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-mid">{field.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-dark">{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TraceList({ label, refs }: { label: string; refs: string[] }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 text-xs text-neutral-mid">
      <p className="font-semibold text-neutral-dark">{label}</p>
      <ul className="mt-1 space-y-1">
        {refs.map((reference) => (
          <li key={reference} className="break-all font-mono">
            {reference}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StateBadge({
  loading,
  failed,
  abstained,
}: {
  loading: boolean;
  failed: boolean;
  abstained: boolean;
}) {
  if (loading) return <QavanteBadge variant="info">Consultando</QavanteBadge>;
  if (failed) return <QavanteBadge variant="warning">No verificable</QavanteBadge>;
  return abstained ? (
    <QavanteBadge variant="warning">No evaluable</QavanteBadge>
  ) : (
    <QavanteBadge variant="success">Publicado</QavanteBadge>
  );
}

function Provenance({ data }: { data: ReaderResponse }) {
  const freshness = "freshness" in data ? data.freshness : "unknown";
  return (
    <div className="mt-4 space-y-2 border-t border-neutral-light/60 pt-3 text-xs text-neutral-mid">
      <p className="flex items-center gap-1.5">
        <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
        Fuente: {data.source_refs.join(", ")}
      </p>
      {"snapshot_hash" in data && data.snapshot_hash && (
        <p className="break-all font-mono">Snapshot: {data.snapshot_hash}</p>
      )}
      <p>
        Frescura:{" "}
        {freshness === "fresh"
          ? "vigente"
          : freshness === "stale"
            ? "desactualizada"
            : "desconocida"}
      </p>
      {data.abstain_reasons && data.abstain_reasons.length > 0 && (
        <p>Motivo: {data.abstain_reasons.join(", ")}</p>
      )}
      <p className="flex items-center gap-1.5 font-semibold">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Sin solicitud, aprobación ni ejecución
      </p>
    </div>
  );
}
