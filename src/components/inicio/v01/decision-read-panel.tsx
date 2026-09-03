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
}: {
  title: string;
  data: ReaderResponse | undefined;
  loading: boolean;
  failed: boolean;
  itemLabel: string;
  itemLabelPlural: string;
  collection: ReaderCollection;
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
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-mid">Sin lectura publicada.</p>
        )}
      </article>
    </QavanteCard>
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
