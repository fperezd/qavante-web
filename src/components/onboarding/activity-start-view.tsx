"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteBadge, QavanteButton, QavanteStatTile } from "@/components/qavante";
import {
  useActivityStartCensus,
  useDeclareActivityStart,
  type OnboardingActivityStartResponse,
} from "@/lib/api/onboarding-activity-start";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import {
  DISTINCION_COPY,
  activityStartErrorCopy,
  declaracionInvalida,
  declaredLine,
  entityRow,
  liveDebtLine,
  liveDebtTotal,
  overlapLine,
  unattributedLine,
  unattributedTotal,
} from "./activity-start-model";

/* Paso del arranque — la empresa DECLARA desde cuándo existe cada sociedad.
   `GET` / `PUT /api/onboarding/activity-start`.

   Es un paso de DECLARACIÓN, no de conexión (mismo molde que el sistema de remuneraciones):
   no conecta ninguna fuente, así que no es diferible al hub de conexiones; igual se puede
   omitir, como el resto del asistente, y omitirlo deja la cifra de lo que falta a la vista.

   Vista partida: `ActivityStartStepView` es presentacional pura (recibe todo por props y se
   puede renderizar en un test sin router ni cliente de datos) y el contenedor de abajo cablea
   los hooks. Patrón del repo.

   Cuatro decisiones de esta pantalla, todas discutibles a propósito:

   1. **Separa las dos declaraciones que se parecen.** La fecha de inicio y el mes desde el que
      leemos se confundían —Fernando mismo no distinguía una de otra el 2026-10-04— así que el
      paso abre nombrando las dos, con su alcance y su tope, antes de pedir nada.
   2. **Una fecha heredada no se ve como una declarada.** Insignia distinta, tono distinto y
      frase distinta por procedencia, y el campo de la sociedad sin declarar nace VACÍO.
   3. **La ausencia tiene su cifra.** Lo que queda sin atribuir va con monto y con documentos;
      nunca como un vacío ni como un cero mudo.
   4. **La deuda viva va al lado, etiquetada como lo que SIGUE contando.** Es la excepción de
      Fernando hecha visible: esa plata no se cae de la posición aunque la fecha no esté
      declarada. */

const NEXT = routeAfter("activity-start");

export interface ActivityStartStepViewProps {
  census: OnboardingActivityStartResponse | undefined;
  isLoading: boolean;
  loadError: unknown;
  onRetry: () => void;
  /** Valor del campo de cada sociedad, por id. Lo que no está acá está vacío. */
  drafts: Record<string, string>;
  onDraftChange: (legalEntityId: string, value: string) => void;
  onDeclare: (legalEntityId: string) => void;
  /** Sociedad cuya declaración se está guardando, o null. */
  savingId: string | null;
  /** Sociedad cuya declaración falló, con su error. */
  saveErrorId: string | null;
  saveError: unknown;
  onContinue: () => void;
  onSkip: () => void;
}

export function ActivityStartStepView({
  census,
  isLoading,
  loadError,
  onRetry,
  drafts,
  onDraftChange,
  onDeclare,
  savingId,
  saveErrorId,
  saveError,
  onContinue,
  onSkip,
}: ActivityStartStepViewProps) {
  return (
    <OnboardingShell
      step="activity-start"
      description="Tu empresa declara desde cuándo existe cada sociedad. Esa fecha manda sobre qué historia se le atribuye: impuestos, ventas, compras, remuneraciones y clasificación."
    >
      <div className="space-y-6">
        {/* 1. Las dos declaraciones que se parecen, separadas antes de pedir nada. */}
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Las dos fechas del arranque">
          <div className="rounded-xl border border-brand-primary/30 bg-brand-primary-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-dark">
              <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              {DISTINCION_COPY.inicioTitulo}
            </p>
            <p className="mt-1 text-xs text-neutral-mid">{DISTINCION_COPY.inicioTexto}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-sm font-semibold text-neutral-dark">
              {DISTINCION_COPY.ventanaTitulo}
            </p>
            <p className="mt-1 text-xs text-neutral-mid">{DISTINCION_COPY.ventanaTexto}</p>
          </div>
        </section>

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-neutral-mid" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reuniendo tus sociedades y la historia que espera una fecha…
          </p>
        )}

        {loadError != null && !isLoading && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
          >
            <p>{activityStartErrorCopy(loadError)}</p>
            <QavanteButton type="button" variant="ghost" onClick={onRetry}>
              Reintentar
            </QavanteButton>
          </div>
        )}

        {census && (
          <>
            {/* 2 y 3. La cifra de lo que falta, y la deuda viva AL LADO. */}
            <section className="space-y-3" aria-label="Lo que espera una fecha declarada">
              <p className="text-sm font-medium text-neutral-dark" role="status">
                {declaredLine(census)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <QavanteStatTile
                  label="Historia sin atribuir"
                  value={unattributedTotal(census).monto}
                  tone="danger"
                  hint={unattributedTotal(census).cobertura}
                  info={unattributedLine(census)}
                />
                <QavanteStatTile
                  label="Deuda viva: SIGUE contando"
                  value={liveDebtTotal(census).cuentas}
                  tone="success"
                  hint={liveDebtTotal(census).cobertura}
                  info={liveDebtLine(census)}
                />
              </div>
              <p className="text-xs text-neutral-mid">{unattributedLine(census)}</p>
              <p className="flex items-start gap-2 rounded-xl border border-success-500/30 bg-success-500/5 p-3 text-xs text-neutral-dark">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600"
                  aria-hidden="true"
                />
                <span>{liveDebtLine(census)}</span>
              </p>
            </section>

            {/* 4. Por qué ves documentos saldados dentro del tramo que pediste mirar. */}
            <section
              className="rounded-xl border border-info-500/30 bg-info-500/5 p-4"
              aria-label="Tu corte de apertura y el tramo que pediste ver"
            >
              <p className="text-sm font-medium text-neutral-dark">
                Por qué ves documentos saldados en el tramo que pediste mirar
              </p>
              <p className="mt-1 text-xs text-neutral-mid">{overlapLine(census)}</p>
            </section>

            {/* Las sociedades, una por una. */}
            <section className="space-y-3" aria-label="Tus sociedades">
              <ul className="space-y-3">
                {census.entities.map((item) => {
                  const row = entityRow(item);
                  const draft = drafts[row.id] ?? row.valorInicial;
                  const invalida = declaracionInvalida(draft);
                  const guardando = savingId === row.id;
                  const falloCopy =
                    saveErrorId === row.id ? activityStartErrorCopy(saveError) : null;
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "rounded-xl border p-4",
                        row.declarada
                          ? "border-success-500/30 bg-success-500/5"
                          : "border-warning-500/40 bg-warning-50/50",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-neutral-dark">{row.nombre}</p>
                        <QavanteBadge variant={row.declarada ? "success" : "warning"}>
                          {row.declarada && <Check className="mr-1 h-3 w-3" aria-hidden="true" />}
                          {row.etiqueta}
                        </QavanteBadge>
                      </div>
                      <p className="mt-1 text-xs text-neutral-mid">{row.linea}</p>

                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <label
                            htmlFor={`activity-start-${row.id}`}
                            className="block text-xs font-medium text-neutral-dark"
                          >
                            Fecha que declara tu empresa
                          </label>
                          <input
                            id={`activity-start-${row.id}`}
                            type="date"
                            value={draft}
                            onChange={(event) => onDraftChange(row.id, event.target.value)}
                            className="flex h-10 w-44 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                          />
                        </div>
                        <QavanteButton
                          type="button"
                          onClick={() => onDeclare(row.id)}
                          loading={guardando}
                          disabled={invalida !== null}
                        >
                          {row.declarada ? "Actualizar la fecha" : "Declarar esta fecha"}
                        </QavanteButton>
                      </div>

                      {invalida !== null && (
                        <p className="mt-2 text-xs text-warning-700">{invalida}</p>
                      )}
                      {falloCopy !== null && (
                        <p className="mt-2 text-xs text-danger-500" role="alert">
                          {falloCopy}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <OnboardingStepActions
          continueType="button"
          continueLabel="Continuar"
          onContinue={onContinue}
          onSkip={onSkip}
          skipLabel="Declararlas después"
        />
      </div>
    </OnboardingShell>
  );
}

/** Contenedor: cablea el censo y la declaración. Nada de copy vive acá. */
export function ActivityStartOnboardingView() {
  const router = useRouter();
  const census = useActivityStartCensus();
  const declare = useDeclareActivityStart();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [saveErrorId, setSaveErrorId] = React.useState<string | null>(null);

  function handleDeclare(legalEntityId: string) {
    const item = census.data?.entities.find((e) => e.legal_entity_id === legalEntityId);
    const draft = drafts[legalEntityId] ?? (item?.declared ? item.effective_from : "");
    /* La misma razón que da el productor con su 422, aplicada antes del viaje. */
    if (declaracionInvalida(draft) !== null) return;
    setSavingId(legalEntityId);
    setSaveErrorId(null);
    declare.mutate(
      { legal_entity_id: legalEntityId, start_date: draft },
      {
        onError: () => setSaveErrorId(legalEntityId),
        onSettled: () => setSavingId(null),
      },
    );
  }

  return (
    <ActivityStartStepView
      census={census.data}
      isLoading={census.isLoading}
      loadError={census.isError ? census.error : null}
      onRetry={() => void census.refetch()}
      drafts={drafts}
      onDraftChange={(id, value) => setDrafts((prev) => ({ ...prev, [id]: value }))}
      onDeclare={handleDeclare}
      savingId={savingId}
      saveErrorId={saveErrorId}
      saveError={declare.error}
      onContinue={() => router.push(NEXT)}
      onSkip={() => router.push(NEXT)}
    />
  );
}
