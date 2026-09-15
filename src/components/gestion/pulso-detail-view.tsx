"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, AlertCircle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { QavanteCard, QavanteEmpty } from "@/components/qavante";
import {
  usePulsoDetail,
  usePulsoScoreReading,
  type PulsoDetailResponse,
  type PulsoDriverDetail,
  type PulsoScoreReading,
} from "@/lib/api/pulso";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatDateLike } from "@/lib/formatters/date";
import { pulsoStatusLabel, pulsoStatusTone } from "@/components/inicio/dashboard-format";
import {
  scoreBarWidth,
  sortDriversByImpact,
  impactLabel,
  isEmptyPulsoDetail,
} from "./pulso-detail-format";
import { PulsoObjetivoSelector } from "./pulso-objetivo-selector";
import { formatPct } from "@/lib/formatters/pct";
import {
  DEFAULT_OBJETIVO,
  readPulsoObjetivo,
  withPulsoObjetivo,
  type PulsoObjetivo,
} from "./pulso-objetivo";
import { pulsoScoreReadingModel } from "./pulso-score-reading-model";

/* Pulso detalle (Sprint C6/C7, Maestro §7): "¿Por qué está así mi Pulso?".
   Score + estado + ejes que lo componen + drivers (+/-) + tendencia. Cada
   sección degrada sola (vacía → no se muestra). Container: resuelve el detalle
   + monta las secciones. Gated por `pulsoDetail` (la page resuelve).

   `objetivoEnabled` (flag `pulsoObjetivo`): habilita el selector de objetivo — el dueño elige qué
   prioriza la empresa y eso re-pondera los ejes. El objetivo se persiste en prefs y se manda al
   endpoint (`?objetivo=`); el re-ponderado lo hace el backend. OFF → comportamiento clásico. */

export function PulsoDetailView({ objetivoEnabled = false }: { objetivoEnabled?: boolean }) {
  const prefsQuery = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const savedObjetivo = readPulsoObjetivo(prefsQuery.data?.preferences);
  const [objetivo, setObjetivo] = React.useState<PulsoObjetivo>(DEFAULT_OBJETIVO);

  // Sincroniza el objetivo local con el guardado cuando cargan las prefs (solo con el flag ON).
  React.useEffect(() => {
    if (objetivoEnabled) setObjetivo(savedObjetivo);
  }, [objetivoEnabled, savedObjetivo]);

  // The detail remains the canonical base view. The objective is rendered only
  // through the separate D09 reading so components and drivers cannot drift.
  const query = usePulsoDetail(undefined, !objetivoEnabled);
  const scoreQuery = usePulsoScoreReading(objetivo, objetivoEnabled);

  function cambiarObjetivo(o: PulsoObjetivo) {
    setObjetivo(o); // refetch con el nuevo foco
    // Persistir: contrato "reemplaza, no merge" → leer el blob actual y mandar el superset. Si el GET
    // de prefs falló, NO persistimos (pisaríamos el resto de las prefs con un blob parcial).
    if (prefsQuery.data) {
      updatePrefs.mutate(withPulsoObjetivo(prefsQuery.data.preferences, o), {
        onError: () => toast.error("No pudimos guardar tu foco. Intenta de nuevo."),
      });
    }
  }

  const selector = objetivoEnabled ? (
    <PulsoObjetivoSelector
      value={objetivo}
      onChange={cambiarObjetivo}
      saving={updatePrefs.isPending}
      applicationState={
        objetivo === "equilibrado"
          ? "base"
          : scoreQuery.isLoading
            ? "pending"
            : scoreQuery.isError || !scoreQuery.data
              ? "unverified"
              : scoreQuery.data.objective_effective &&
                  scoreQuery.data.focused_abstention_reason === null
                ? "applied"
                : "not_applied"
      }
    />
  ) : null;

  let contenido: React.ReactNode;
  if (objetivoEnabled ? scoreQuery.isLoading : query.isLoading) {
    contenido = <LoadingSkeleton />;
  } else if (objetivoEnabled ? scoreQuery.isError : query.isError) {
    const error = objetivoEnabled ? scoreQuery.error : query.error;
    contenido = (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {error instanceof ApiError
            ? apiErrorToUserMessage(error)
            : "No pudimos cargar el detalle de tu Pulso. Intenta nuevamente."}
        </p>
      </div>
    );
  } else if (objetivoEnabled) {
    contenido = scoreQuery.data ? <Detail scoreReading={scoreQuery.data} /> : null;
  } else {
    contenido = query.data ? <Detail data={query.data} /> : null;
  }

  if (!selector) return <>{contenido}</>;
  return (
    <div className="space-y-4">
      {selector}
      {contenido}
    </div>
  );
}

function Detail({
  data,
  scoreReading,
}: {
  data?: PulsoDetailResponse;
  scoreReading?: PulsoScoreReading;
}) {
  const scoreModel = scoreReading ? pulsoScoreReadingModel(scoreReading) : null;
  if (scoreModel?.state === "unavailable") {
    return (
      <QavanteEmpty
        icon={Activity}
        title="Pulso no publicable todavía"
        description={scoreModel.unavailableReason ?? "No hay evidencia suficiente para calcularlo."}
      />
    );
  }
  if (
    (!scoreModel && (!data || isEmptyPulsoDetail(data))) ||
    (scoreModel && scoreModel.baseScore === null)
  ) {
    return <EmptyDetail />;
  }

  const positives = sortDriversByImpact(
    (data?.drivers ?? []).filter((d) => d.direction === "positive"),
  );
  const negatives = sortDriversByImpact(
    (data?.drivers ?? []).filter((d) => d.direction === "negative"),
  );
  const displayedScore = scoreModel ? scoreModel.baseScore : data?.score;
  const displayedStatus = scoreModel ? scoreModel.baseStatus : data?.status;

  return (
    <div className="space-y-4">
      {/* Score destacado. */}
      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {scoreModel ? "Pulso base del negocio" : "Pulso del negocio"}
            </p>
            <p className={"text-4xl font-bold " + pulsoStatusTone(displayedStatus)}>
              {displayedScore}
              <span className="ml-2 text-xl">{pulsoStatusLabel(displayedStatus)}</span>
            </p>
            {!scoreModel && data?.preliminary && (
              <p className="mt-0.5 text-xs text-neutral-mid">Preliminar</p>
            )}
          </div>
        </div>
        {!scoreModel && data?.headline && (
          <p className="mt-3 text-sm text-neutral-dark">{data.headline}</p>
        )}
        {scoreModel && (
          <div className="mt-3 border-t border-neutral-light pt-3 text-xs text-neutral-mid">
            <p>{scoreModel.freshnessLabel}</p>
            <p className="mt-0.5">Metodología {scoreModel.methodologyLabel}</p>
          </div>
        )}
      </QavanteCard>

      {scoreModel?.focusLabel && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Lectura con foco: {scoreModel.focusLabel}</span>}
        >
          {scoreModel.focusUnavailable ? (
            <p className="text-sm text-neutral-mid">
              El Pulso base está disponible, pero este foco no se pudo aplicar al mismo corte con
              evidencia suficiente. No mostramos una cifra estimada.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-3">
              <p className={"text-3xl font-bold " + pulsoStatusTone(scoreModel.focusedStatus)}>
                {scoreModel.focusedScore}
                <span className="ml-2 text-base">{pulsoStatusLabel(scoreModel.focusedStatus)}</span>
              </p>
              {scoreModel.delta !== null && (
                <p className="text-sm tabular-nums text-neutral-mid">
                  {scoreModel.delta >= 0 ? "+" : ""}
                  {scoreModel.delta} puntos frente al Pulso base
                </p>
              )}
            </div>
          )}
        </QavanteCard>
      )}

      {/* Ejes que componen el índice. */}
      {(scoreModel ? scoreModel.baseFactors.length > 0 : (data?.components.length ?? 0) > 0) && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Qué compone tu Pulso</span>}
        >
          <ul className="qv-stagger-bars space-y-3">
            {(scoreModel?.baseFactors ?? data?.components ?? []).map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-neutral-dark">{c.label}</span>
                  <span className="tabular-nums text-neutral-mid">
                    {c.score}
                    <span className="ml-1 text-xs">· peso {formatPct(c.weight * 100)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-light/40">
                  <div
                    className="animate-qv-grow-x h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-primary/55"
                    style={{ width: scoreBarWidth(c.score) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}

      {scoreModel && scoreModel.omittedFactorLabels.length > 0 && (
        <p className="text-xs text-neutral-mid">
          Factores sin evidencia en este corte: {scoreModel.omittedFactorLabels.join(", ")}.
        </p>
      )}

      {/* Drivers. */}
      {(positives.length > 0 || negatives.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DriverColumn title="Lo que ayuda" tone="positive" drivers={positives} />
          <DriverColumn title="Lo que pesa" tone="negative" drivers={negatives} />
        </div>
      )}

      {/* Tendencia. */}
      {!scoreModel && data && data.trend.length > 0 && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Tendencia</span>}>
          <div className="flex items-end justify-between gap-2" aria-hidden="true">
            {data.trend.map((t) => (
              <div key={t.period} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="animate-qv-grow-y w-full origin-bottom rounded-t bg-gradient-to-t from-brand-primary to-brand-primary/50"
                    style={{ height: scoreBarWidth(t.score) }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-neutral-mid">{t.score}</span>
                <span className="text-[10px] text-neutral-mid">{formatDateLike(t.period)}</span>
              </div>
            ))}
          </div>
          <p className="sr-only">
            Histórico del Pulso:{" "}
            {data.trend.map((t) => `${formatDateLike(t.period)}: ${t.score}`).join("; ")}.
          </p>
        </QavanteCard>
      )}
    </div>
  );
}

function DriverColumn({
  title,
  tone,
  drivers,
}: {
  title: string;
  tone: "positive" | "negative";
  drivers: PulsoDriverDetail[];
}) {
  const Icon = tone === "positive" ? TrendingUp : TrendingDown;
  const color = tone === "positive" ? "text-success-700" : "text-danger-500";
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={
        <span className={"flex items-center gap-1.5 font-medium " + color}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {title}
        </span>
      }
    >
      {drivers.length === 0 ? (
        <p className="text-sm text-neutral-mid">Sin factores por ahora.</p>
      ) : (
        <ul className="space-y-3">
          {drivers.map((d) => (
            <li key={d.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-neutral-dark">{d.label}</span>
                <span className="shrink-0 text-xs text-neutral-mid">{impactLabel(d.impact)}</span>
              </div>
              <p className="mt-0.5 text-neutral-mid">{d.detail}</p>
              {d.cta_href && d.cta_label && (
                <Link
                  href={d.cta_href}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {d.cta_label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </QavanteCard>
  );
}

function EmptyDetail() {
  return (
    <QavanteEmpty
      icon={Activity}
      title="Tu Pulso todavía se está calculando"
      description="Cuando tengamos suficientes datos (caja, cobranza, resultado) vas a ver acá tu índice de salud, qué lo compone y qué lo empuja arriba o abajo."
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Cargando la lectura del Pulso.</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-neutral-light/30" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" />
          <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" />
        </div>
      </div>
    </div>
  );
}
