"use client";

import { AlertCircle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import {
  useFinancialDecisions,
  useFinancialPosition,
  type FinancialDecisionList,
  type FinancialPosition,
} from "@/lib/api/financial-decisions";
import { formatDateLike } from "@/lib/formatters/date";
import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { positionPresentation, visiblePositionAmounts } from "./financial-position-card-model";

const eventLabel: Record<string, string> = {
  deficit: "Déficit detectado",
  surplus: "Excedente detectado",
  structural_warning: "Advertencia estructural",
};

export function FinancialPositionCard() {
  const position = useFinancialPosition();
  const decisions = useFinancialDecisions();

  if (position.isLoading || decisions.isLoading) return <FinancialPositionSkeleton />;
  if (position.isError || decisions.isError) return <FinancialPositionError />;
  if (!position.data || !decisions.data) return null;

  return <FinancialPositionContent position={position.data} decisions={decisions.data} />;
}

export function FinancialPositionContent({
  position,
  decisions,
}: {
  position: FinancialPosition;
  decisions: FinancialDecisionList;
}) {
  const presentation = positionPresentation(position);
  const availableAmounts = visiblePositionAmounts(position);
  const events = position.active_events ?? [];
  const items = decisions.items ?? [];
  const abstained = presentation === "abstained";
  const partial = presentation === "partial";

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Posición financiera
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-mid">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Al {formatDateLike(position.as_of)}
          </span>
        </div>
      }
    >
      {abstained ? (
        <div className="flex items-start gap-2.5 text-sm text-neutral-mid">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-dark">
              Aún no hay una posición financiera elegible.
            </p>
            <p className="mt-1">
              Faltan política o evidencia vigente para emitir una conclusión. No mostramos una
              recomendación ni asumimos montos.
            </p>
          </div>
        </div>
      ) : !position.currency ? (
        <p className="text-sm text-neutral-mid">
          La fuente no informó la moneda. Para no asumir CLP ni mezclar monedas, no mostramos
          montos.
        </p>
      ) : availableAmounts.length > 0 ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {availableAmounts.map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <dt className="text-neutral-mid">{label}</dt>
              <dd className="font-semibold tabular-nums text-neutral-dark">
                {formatMoney(value, position.currency)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-neutral-mid">
          No hay montos financieros disponibles para mostrar.
        </p>
      )}

      {partial && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-warning-700">
          Datos parciales: los montos visibles no constituyen una conclusión financiera ni una
          recomendación.
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          {events.map((event) => {
            const amount = parseAmountOrNull(event.amount);
            return (
              <li
                key={`${event.event_type}-${event.event_start}`}
                className="flex justify-between gap-3"
              >
                <span className="text-neutral-dark">
                  {eventLabel[event.event_type] ?? event.event_type} ·{" "}
                  {formatDateLike(event.event_start)}
                </span>
                {amount != null && (
                  <span className="shrink-0 font-medium tabular-nums text-neutral-dark">
                    {formatMoney(amount, event.currency)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <DecisionState items={items} />
    </QavanteCard>
  );
}

function DecisionState({ items }: { items: NonNullable<FinancialDecisionList["items"]> }) {
  if (items.length === 0) {
    return (
      <p className="mt-4 border-t border-border pt-3 text-sm text-neutral-mid">
        Sin decisiones persistidas.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
      {items.map((decision) => (
        <li key={decision.id} className="flex items-center gap-2 text-neutral-dark">
          {decision.decision_support === "eligible" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
          )}
          <span>
            {eventLabel[decision.event_type] ?? decision.event_type}
            {decision.decision_support === "abstain" && " · sin recomendación disponible"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FinancialPositionError() {
  return (
    <QavanteCard variant="bordered" header="Posición financiera">
      <p className="text-sm text-neutral-mid">
        No pudimos cargar la posición financiera ahora. No se muestran datos anteriores como si
        estuvieran vigentes.
      </p>
    </QavanteCard>
  );
}

function FinancialPositionSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
}
