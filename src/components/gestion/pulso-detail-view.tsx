"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertCircle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { QavanteCard, QavanteEmpty } from "@/components/qavante";
import { usePulsoDetail, type PulsoDetailResponse, type PulsoDriverDetail } from "@/lib/api/pulso";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatDateLike } from "@/lib/formatters/date";
import {
  pulsoStatusLabel,
  pulsoStatusTone,
  confidenceLabel,
} from "@/components/inicio/dashboard-format";
import {
  scoreBarWidth,
  sortDriversByImpact,
  impactLabel,
  isEmptyPulsoDetail,
} from "./pulso-detail-format";

/* Pulso detalle (Sprint C6/C7, Maestro §7): "¿Por qué está así mi Pulso?".
   Score + estado + ejes que lo componen + drivers (+/-) + tendencia. Cada
   sección degrada sola (vacía → no se muestra). Container: resuelve el detalle
   + monta las secciones. Gated por `pulsoDetail` (la page resuelve). */

export function PulsoDetailView() {
  const query = usePulsoDetail();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {query.error instanceof ApiError
            ? apiErrorToUserMessage(query.error)
            : "No pudimos cargar el detalle de tu Pulso. Intenta nuevamente."}
        </p>
      </div>
    );
  }
  if (!query.data) return null;
  return <Detail data={query.data} />;
}

function Detail({ data }: { data: PulsoDetailResponse }) {
  if (isEmptyPulsoDetail(data)) return <EmptyDetail />;

  const positives = sortDriversByImpact(data.drivers.filter((d) => d.direction === "positive"));
  const negatives = sortDriversByImpact(data.drivers.filter((d) => d.direction === "negative"));

  return (
    <div className="space-y-4">
      {/* Score destacado. */}
      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Pulso del negocio
            </p>
            <p className={"text-4xl font-bold " + pulsoStatusTone(data.status)}>
              {data.score}
              <span className="ml-2 text-xl">{pulsoStatusLabel(data.status)}</span>
            </p>
            <p className="mt-0.5 text-xs text-neutral-mid">
              {confidenceLabel(data.confidence)}
              {data.preliminary && " · preliminar"}
            </p>
          </div>
        </div>
        {data.headline && <p className="mt-3 text-sm text-neutral-dark">{data.headline}</p>}
      </QavanteCard>

      {/* Ejes que componen el índice. */}
      {data.components.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Qué compone tu Pulso</span>}
        >
          <ul className="space-y-3">
            {data.components.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-neutral-dark">{c.label}</span>
                  <span className="tabular-nums text-neutral-mid">
                    {c.score}
                    <span className="ml-1 text-xs">· peso {Math.round(c.weight * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-light/40">
                  <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: scoreBarWidth(c.score) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}

      {/* Drivers. */}
      {(positives.length > 0 || negatives.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DriverColumn title="Lo que ayuda" tone="positive" drivers={positives} />
          <DriverColumn title="Lo que pesa" tone="negative" drivers={negatives} />
        </div>
      )}

      {/* Tendencia. */}
      {data.trend.length > 0 && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Tendencia</span>}>
          <div className="flex items-end justify-between gap-2" aria-hidden="true">
            {data.trend.map((t) => (
              <div key={t.period} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t bg-brand-primary/70"
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
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" />
        <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" />
      </div>
    </div>
  );
}
