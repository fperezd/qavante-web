"use client";

import * as React from "react";
import { Banner } from "@/components/rediseno/banner";
import { Pill } from "@/components/rediseno/pill";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import type { FinancialAgreementTransitionRequest } from "@/lib/api/financial-agreements";
import { agreementDetailView, type AgreementDetailView } from "./acuerdo-detalle-model";
import type { FinancialAgreementDetailResponse } from "@/lib/api/financial-agreements";

interface ScheduleDraftRow {
  dueDate: string;
  amount: string;
}

export interface FormalizeDraft {
  effectiveOn: string;
  externalReference: string;
  evidenceRef: string;
  schedule: ScheduleDraftRow[];
}

export function emptyFormalizeDraft(): FormalizeDraft {
  return {
    effectiveOn: "",
    externalReference: "",
    evidenceRef: "",
    schedule: [{ dueDate: "", amount: "" }],
  };
}

/** Traduce un borrador de formalización a la request del contrato. Lanza si el borrador no
 * alcanza a armar un calendario válido — el caller lo muestra como error de formulario, el
 * backend es quien valida de verdad (regla de la casa: el form nunca duplica su lógica). */
export function formalizeDraftToRequest(
  draft: FormalizeDraft,
  responsibleUserId: string,
  idempotencyKey: string,
): FinancialAgreementTransitionRequest {
  const schedule = draft.schedule
    .filter((row) => row.dueDate.trim() !== "" && row.amount.trim() !== "")
    .map((row, index) => ({ sequence: index + 1, due_date: row.dueDate, amount: row.amount }));
  const agreedTotal = schedule.reduce((sum, row) => sum + Number(row.amount), 0);
  return {
    idempotency_key: idempotencyKey,
    to_state: "formalized",
    formalized_terms: {
      effective_on: draft.effectiveOn,
      agreed_total_amount: String(agreedTotal),
      external_reference: draft.externalReference,
      evidence_refs: [draft.evidenceRef],
      responsible_user_id: responsibleUserId,
      schedule,
    },
  };
}

function FormalizeForm({
  onSubmit,
  isSubmitting,
  error,
}: {
  onSubmit: (draft: FormalizeDraft) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = React.useState<FormalizeDraft>(emptyFormalizeDraft());

  return (
    <form
      className="space-y-3 rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <p className="font-medium text-rediseno-tinta">Formalizar acuerdo</p>
      <p className="text-[12px] text-rediseno-tinta-2">
        Formalizar es la ÚNICA acción que después cambia la caja y Pagar/Cobrar: reemplaza el
        vencimiento del documento por este calendario. Mientras el acuerdo esté sólo propuesto,
        nada del escenario real cambia.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-rediseno-tinta-2">
          Vigente desde
          <QavanteInput
            variant="date"
            value={draft.effectiveOn}
            onValueChange={(raw) => setDraft({ ...draft, effectiveOn: raw })}
            required
          />
        </label>
        <label className="text-[12px] text-rediseno-tinta-2">
          Referencia (resolución, acta, correo)
          <QavanteInput
            value={draft.externalReference}
            onValueChange={(raw) => setDraft({ ...draft, externalReference: raw })}
            required
          />
        </label>
      </div>
      <label className="block text-[12px] text-rediseno-tinta-2">
        Evidencia (ruta o referencia del respaldo)
        <QavanteInput
          value={draft.evidenceRef}
          onValueChange={(raw) => setDraft({ ...draft, evidenceRef: raw })}
          required
        />
      </label>
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-rediseno-tinta-2">Calendario</p>
        {draft.schedule.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <QavanteInput
              variant="date"
              value={row.dueDate}
              onValueChange={(raw) => {
                const schedule = [...draft.schedule];
                schedule[index] = { ...row, dueDate: raw };
                setDraft({ ...draft, schedule });
              }}
              required
            />
            <QavanteInput
              variant="number"
              placeholder="Monto"
              value={row.amount}
              onValueChange={(raw) => {
                const schedule = [...draft.schedule];
                schedule[index] = { ...row, amount: raw };
                setDraft({ ...draft, schedule });
              }}
              required
            />
          </div>
        ))}
        <QavanteButton
          type="button"
          variant="ghost"
          onClick={() => setDraft({ ...draft, schedule: [...draft.schedule, { dueDate: "", amount: "" }] })}
        >
          Agregar cuota
        </QavanteButton>
      </div>
      {error && <p className="text-[12px] text-rediseno-rojo">{error}</p>}
      <QavanteButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Formalizando…" : "Formalizar"}
      </QavanteButton>
    </form>
  );
}

export function AcuerdoDetalleView({
  agreement,
  onFormalize,
  isFormalizing,
  formalizeError,
}: {
  agreement: FinancialAgreementDetailResponse;
  onFormalize: (draft: FormalizeDraft) => void;
  isFormalizing: boolean;
  formalizeError: string | null;
}) {
  const view: AgreementDetailView = agreementDetailView(agreement);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-rediseno-display text-[24px] leading-tight text-rediseno-tinta">
            {view.kindLabel}
          </h1>
          <p className="text-[12px] text-rediseno-tinta-2">
            {view.directionLabel} · {view.currencyCode}
          </p>
        </div>
        <Pill variant={view.stateVariant}>{view.stateLabel}</Pill>
      </div>

      {!view.isFormalized && (
        <Banner variant="warn">
          Este acuerdo todavía es sólo una propuesta: no reemplaza nada en la caja ni en
          Pagar/Cobrar hasta que se formalice.
        </Banner>
      )}

      <section aria-labelledby="acuerdo-sujetos" className="space-y-2">
        <h2 id="acuerdo-sujetos" className="text-[13px] font-semibold text-rediseno-tinta">
          Documentos cubiertos
        </h2>
        <ul className="space-y-1">
          {view.subjects.map((subject, index) => (
            <li key={index} className="flex justify-between text-[13px] text-rediseno-tinta-2">
              <span>
                {subject.kind} · {subject.reference}
              </span>
              <span className="tabular-nums">{subject.coveredAmountLabel}</span>
            </li>
          ))}
        </ul>
      </section>

      {view.schedule && (
        <section aria-labelledby="acuerdo-calendario" className="space-y-2">
          <h2 id="acuerdo-calendario" className="text-[13px] font-semibold text-rediseno-tinta">
            Calendario vigente
          </h2>
          <ul className="space-y-1">
            {view.schedule.map((row) => (
              <li
                key={row.sequence}
                className="flex justify-between text-[13px] text-rediseno-tinta-2"
              >
                <span>Cuota {row.sequence} · {row.dueDateLabel}</span>
                <span className="tabular-nums">{row.amountLabel}</span>
              </li>
            ))}
          </ul>
          {view.agreedTotalLabel && (
            <p className="text-[12px] text-rediseno-tinta-3">
              Total acordado {view.agreedTotalLabel}
              {view.externalReference ? ` · ${view.externalReference}` : ""}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="acuerdo-eventos" className="space-y-2">
        <h2 id="acuerdo-eventos" className="text-[13px] font-semibold text-rediseno-tinta">
          Historial
        </h2>
        <ul className="space-y-1">
          {view.events.map((event) => (
            <li key={event.sequence} className="flex items-center gap-2 text-[13px]">
              <Pill variant={event.stateVariant}>{event.stateLabel}</Pill>
              <span className="text-rediseno-tinta-2">{event.occurredAtLabel}</span>
              {event.reason && <span className="text-rediseno-tinta-3">· {event.reason}</span>}
            </li>
          ))}
        </ul>
      </section>

      {view.canFormalize && (
        <FormalizeForm
          onSubmit={onFormalize}
          isSubmitting={isFormalizing}
          error={formalizeError}
        />
      )}
    </div>
  );
}
