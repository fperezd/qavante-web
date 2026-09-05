import { FileSearch, ShieldCheck } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type {
  FxEvaluationRead,
  FxExposureRead,
  InvestmentEvaluationRead,
  InvestableSurplusRead,
  OutcomeValueRead,
} from "@/lib/api/financial-decision-readers";
import {
  itemCount,
  itemSummary,
  outcomeDecisionView,
  type OutcomeDecisionView,
  type ReaderCollection,
  type ReaderResponse,
} from "./decision-read-model";

interface ReaderState<T extends ReaderResponse> {
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
          Snapshots acotados a la entidad, moneda y fecha publicadas por el backend. No crean ni
          seleccionan operaciones.
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
    </section>
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
        <p className="mt-1 text-xs text-neutral-mid">Confianza: {view.confidence}</p>
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
