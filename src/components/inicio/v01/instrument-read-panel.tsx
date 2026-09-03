import { Ban, CircleDashed, FileCheck2, ShieldCheck } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type { InstrumentReadView, OutcomeLedgerUnavailableView } from "./instrument-read-model";

export interface InstrumentReadPanelProps {
  instruments: readonly InstrumentReadView[];
  outcomeLedger: OutcomeLedgerUnavailableView;
  unavailable?: boolean;
}

/** Read-only V01 surface for F6/F7/F9. It deliberately exposes no selection or execution action. */
export function InstrumentReadPanel({
  instruments,
  outcomeLedger,
  unavailable = false,
}: InstrumentReadPanelProps) {
  if (unavailable) {
    return <UnavailableState />;
  }

  return (
    <section aria-labelledby="instrument-read-title" className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Próximas decisiones
        </p>
        <h3 id="instrument-read-title" className="mt-1 text-lg font-semibold text-neutral-dark">
          Instrumentos en evaluación
        </h3>
        <p className="mt-1 text-sm text-neutral-mid">
          Lectura contractual. Esta capa no selecciona, solicita, aprueba ni ejecuta instrumentos.
        </p>
      </div>
      {instruments.length === 0 ? (
        <UnavailableState />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Instrumentos financieros">
          {instruments.map((instrument) => (
            <li key={instrument.id}>
              <InstrumentCard view={instrument} />
            </li>
          ))}
        </ul>
      )}
      <OutcomeLedgerCard view={outcomeLedger} />
      <p className="flex items-start gap-2 text-xs font-semibold text-neutral-mid">
        <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Sin envío ni ejecución desde esta vista
      </p>
    </section>
  );
}

function UnavailableState() {
  return (
    <QavanteCard variant="bordered">
      <section className="flex items-start gap-3" aria-label="Instrumentos no disponibles">
        <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
        <div>
          <p className="font-semibold text-neutral-dark">Instrumentos no disponibles</p>
          <p className="mt-1 text-sm text-neutral-mid">
            Aún no hay un snapshot canónico y evaluable. Esta vista no infiere instrumentos,
            cotizaciones, moneda, vigencia ni resultados.
          </p>
        </div>
      </section>
    </QavanteCard>
  );
}

function InstrumentCard({ view }: { view: InstrumentReadView }) {
  return (
    <QavanteCard variant="bordered" className="h-full">
      <article aria-labelledby={`instrument-${view.id.replaceAll(":", "-")}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {view.familyLabel}
            </p>
            <h4
              id={`instrument-${view.id.replaceAll(":", "-")}`}
              className="mt-1 text-base font-semibold text-neutral-dark"
            >
              {view.code}
            </h4>
          </div>
          <QavanteBadge variant={view.tone}>{view.stateLabel}</QavanteBadge>
        </div>
        <p className="mt-3 text-sm text-neutral-mid">{view.stateDescription}</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Costo" value={view.costLabel} />
          <Detail
            label="Evidencia"
            value={
              view.evidenceRefs.length
                ? `${view.evidenceRefs.length} referencia${view.evidenceRefs.length === 1 ? "" : "s"}`
                : "No informada"
            }
          />
          <Detail label="Vigencia" value={view.validityLabel} />
        </dl>
        {view.evidenceRefs.length > 0 && (
          <ReferenceList
            label={`Referencias de evidencia de ${view.code}`}
            values={view.evidenceRefs}
          />
        )}
        {view.reasonCodes.length > 0 && (
          <ReferenceList label={`Causas contractuales de ${view.code}`} values={view.reasonCodes} />
        )}
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid">
          {view.isNoAction ? (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {view.isNoAction ? "Alternativa no_action · sin operación" : "Sólo lectura"}
        </p>
      </article>
    </QavanteCard>
  );
}

function ReferenceList({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <ul
      className="mt-3 list-disc space-y-1 border-t border-neutral-light/60 pl-5 pt-3 text-xs text-neutral-mid"
      aria-label={label}
    >
      {values.map((value) => (
        <li key={value} className="break-all font-mono">
          {value}
        </li>
      ))}
    </ul>
  );
}

function OutcomeLedgerCard({ view }: { view: OutcomeLedgerUnavailableView }) {
  return (
    <QavanteCard variant="bordered">
      <section aria-labelledby="outcome-ledger-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Aprendizaje verificable
            </p>
            <h4 id="outcome-ledger-title" className="mt-1 font-semibold text-neutral-dark">
              {view.title}
            </h4>
          </div>
          <QavanteBadge variant="default">No disponible</QavanteBadge>
        </div>
        <p className="mt-3 text-sm text-neutral-mid">{view.description}</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Resultado" value={view.outcomeLabel} />
          <Detail label="Value Ledger" value={view.valueLedgerLabel} />
        </dl>
      </section>
    </QavanteCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-neutral-dark">{value}</dd>
    </div>
  );
}
