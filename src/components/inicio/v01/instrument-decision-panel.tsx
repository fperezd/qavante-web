import { Ban, CircleDashed, FileCheck2, ShieldCheck } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import type {
  ContractDependencyView,
  DecisionLayerView,
  InstrumentAlternativeView,
  InstrumentTone,
} from "./instrument-decision-model";

const BADGE_VARIANT: Record<InstrumentTone, "default" | "info" | "warning" | "success"> = {
  neutral: "default",
  info: "info",
  warning: "warning",
  success: "success",
};

export function InstrumentDecisionPanel({ layer }: { layer: DecisionLayerView }) {
  return (
    <section aria-labelledby="instrument-decisions-title" className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Próximas decisiones
        </p>
        <h3
          id="instrument-decisions-title"
          className="mt-1 text-lg font-semibold text-neutral-dark"
        >
          Instrumentos en evaluación
        </h3>
        <p className="mt-1 text-sm text-neutral-mid">
          Lectura contractual. Esta capa no selecciona, solicita, aprueba ni ejecuta instrumentos.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Instrumentos financieros">
        {layer.instruments.map((item) => (
          <li key={item.id}>
            {item.kind === "alternative" ? (
              <InstrumentAlternativeCard view={item} />
            ) : (
              <ContractDependencyCard view={item} />
            )}
          </li>
        ))}
      </ul>

      <OutcomeLedgerCard view={layer.outcomeLedger} />

      <p className="flex items-start gap-2 text-xs font-semibold text-neutral-mid">
        <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {layer.externalDeliveryLabel}
      </p>
    </section>
  );
}

function InstrumentAlternativeCard({ view }: { view: InstrumentAlternativeView }) {
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
              {view.title}
            </h4>
            <p className="mt-1 break-all text-xs text-neutral-mid">Código: {view.code}</p>
          </div>
          <QavanteBadge variant={BADGE_VARIANT[view.stateTone]}>{view.stateLabel}</QavanteBadge>
        </div>

        <p className="mt-3 text-sm text-neutral-mid">{view.stateDescription}</p>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Costo" value={view.costLabel} />
          <Detail
            label="Evidencia"
            value={
              view.evidenceRefs.length > 0
                ? `${view.evidenceRefs.length} referencia${view.evidenceRefs.length === 1 ? "" : "s"}`
                : "No informada"
            }
          />
          <Detail label="Vigencia" value={view.validityLabel} />
        </dl>

        {view.evidenceRefs.length > 0 && (
          <ul
            className="mt-3 space-y-1 text-xs text-neutral-mid"
            aria-label={`Referencias de evidencia de ${view.title}`}
          >
            {view.evidenceRefs.map((reference) => (
              <li key={reference} className="break-all font-mono">
                {reference}
              </li>
            ))}
          </ul>
        )}

        {view.reasonCodes.length > 0 && (
          <div className="mt-3 border-t border-neutral-light/60 pt-3">
            <p className="text-xs font-semibold text-neutral-dark">Causas contractuales</p>
            <ul
              className="mt-1 list-disc space-y-1 pl-5 text-xs text-neutral-mid"
              aria-label={`Causas contractuales de ${view.title}`}
            >
              {view.reasonCodes.map((reason) => (
                <li key={reason} className="break-all font-mono">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
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

function ContractDependencyCard({ view }: { view: ContractDependencyView }) {
  return (
    <QavanteCard variant="bordered" className="h-full">
      <article aria-labelledby={`dependency-${view.id.replaceAll(":", "-")}`}>
        <div className="flex items-start gap-3">
          <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div>
            <h4
              id={`dependency-${view.id.replaceAll(":", "-")}`}
              className="font-semibold text-neutral-dark"
            >
              {view.title}
            </h4>
            <p className="mt-1 text-sm text-neutral-mid">{view.description}</p>
            <p className="mt-2 text-xs font-semibold text-neutral-mid">
              Dependencia: {view.dependency}
            </p>
          </div>
        </div>
      </article>
    </QavanteCard>
  );
}

function OutcomeLedgerCard({ view }: { view: ContractDependencyView }) {
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
          <QavanteBadge variant="default">Sin contrato público</QavanteBadge>
        </div>
        <p className="mt-3 text-sm text-neutral-mid">{view.description}</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Resultado" value="Sin dato" />
          <Detail label="Value Ledger" value="Sin dato" />
        </dl>
        <p className="mt-3 text-xs font-semibold text-neutral-mid">
          Dependencia: {view.dependency}
        </p>
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
