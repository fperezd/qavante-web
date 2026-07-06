"use client";

import * as React from "react";
import { X, Info, FileText } from "lucide-react";
import {
  QavanteCard,
  QavanteButton,
  QavanteInput,
  QavanteBadge,
  QavanteInlineError,
} from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import { useSiiF29Impuesto, useSiiF29Giros, siiF29PdfUrl } from "@/lib/api/sii";

/* Detalle F29 de un mes (handoff CC-API): dos montos lado a lado — pagar todo
   (`total_con_iva`) vs postergar el IVA (`total_sin_iva`) — + desglose e input
   manual del impuesto a trabajadores cuando la fuente es `no_disponible`. */

const FUENTE_LABEL: Record<string, string> = {
  buk: "desde BUK",
  manual: "ingresado a mano",
  no_disponible: "sin dato",
};

export function F29MonthDetail({
  anio,
  mes,
  mesLabel,
  onClose,
}: {
  anio: number;
  mes: number;
  mesLabel: string;
  onClose: () => void;
}) {
  /* Impuesto a trabajadores ingresado a mano (cuando la fuente es no_disponible).
     `undefined` = usar lo que traiga el backend. */
  const [manual, setManual] = React.useState<number | undefined>(undefined);
  const [draft, setDraft] = React.useState("");

  const query = useSiiF29Impuesto(anio, mes, manual);
  const data = query.data;

  /* Estado de pago/postergación (Consulta de Giros, en vivo). NO afirma "pagado"
     ante error → si `giros` falla, no mostramos badge (estado base). */
  const giros = useSiiF29Giros(anio, mes);
  const girosData = giros.isError ? undefined : giros.data;
  const postergado = girosData?.postergado_iva === true;
  const pagado = girosData?.estado === "sin_giro" && data?.declarado === true;

  return (
    <QavanteCard
      variant="bordered"
      aria-label={`Detalle F29 de ${mesLabel} ${anio}`}
      role="region"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            F29 · {mesLabel} {anio}
            {data?.folio ? <QavanteBadge variant="info">folio {data.folio}</QavanteBadge> : null}
            {data && !data.declarado ? (
              <QavanteBadge variant="warning">estimado (sin declarar)</QavanteBadge>
            ) : null}
            {postergado ? (
              <QavanteBadge variant="warning">IVA postergado</QavanteBadge>
            ) : pagado ? (
              <QavanteBadge variant="success">Pagado</QavanteBadge>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-md p-1 text-neutral-mid hover:bg-surface-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      }
    >
      {query.isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-neutral-light/30" aria-busy="true" />
      ) : query.isError ? (
        <QavanteInlineError
          error={query.error}
          what="el detalle del F29"
          onRetry={() => query.refetch()}
        />
      ) : !data ? (
        <p className="text-sm text-neutral-mid">Sin datos para este período.</p>
      ) : (
        <div className="space-y-4">
          {/* Dos opciones de pago lado a lado. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PayOption
              tone="full"
              label="Pagar todo"
              amount={data.total_con_iva}
              hint="Incluye el IVA determinado del período."
            />
            <PayOption
              tone="defer"
              label="Postergar el IVA"
              amount={data.total_sin_iva}
              hint={
                data.iva_postergable > 0
                  ? `Postergás ${formatClp(data.iva_postergable)} de IVA (vence en ~2 meses).`
                  : "No hay IVA postergable este período."
              }
            />
          </div>

          {/* Si el SII ya registra el IVA postergado, lo mostramos como hecho. */}
          {postergado && girosData && (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 p-3 text-sm text-warning-700">
              IVA ya postergado
              {girosData.iva_postergado != null ? ` de ${formatClp(girosData.iva_postergado)}` : ""}
              {girosData.vencimiento_postergado
                ? ` · vence el ${formatDateLike(girosData.vencimiento_postergado)}`
                : ""}
              .
            </div>
          )}

          {/* Desglose. */}
          <div className="rounded-xl border border-border bg-surface-muted p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Desglose
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              <Row label="IVA débito" value={data.iva_debito} />
              <Row label="IVA crédito" value={data.iva_credito} />
              <Row label="IVA determinado" value={data.iva_determinado} />
              <Row label="Remanente" value={data.remanente} />
              <Row label="PPM" value={data.ppm} />
              <Row
                label="Impuesto trabajadores"
                value={data.impuesto_trabajadores}
                sub={FUENTE_LABEL[data.fuente_impuesto_trabajadores] ?? undefined}
                unreliable={data.fuente_impuesto_trabajadores === "no_disponible"}
              />
            </dl>
          </div>

          {/* Drill-down: ver el Certificado Solemne (PDF) del F29 en el SII. */}
          {data.folio && siiF29PdfUrl(data.folio) && (
            <a
              href={siiF29PdfUrl(data.folio) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Ver F29 (PDF) en el SII
            </a>
          )}

          {/* Input manual cuando no hay fuente confiable del impuesto trabajadores. */}
          {data.fuente_impuesto_trabajadores === "no_disponible" && (
            <div className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-warning-700">
                  No tenemos el impuesto a trabajadores (código 48) de este período. Ingrésalo para
                  recalcular los totales.
                </p>
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = draft.replace(/[^\d]/g, "");
                    if (clean === "") return; // vacío ≠ $0 confirmado (no-op)
                    const n = Number(clean);
                    if (Number.isFinite(n) && n >= 0) setManual(n);
                  }}
                >
                  <QavanteInput
                    aria-label="Impuesto a trabajadores (código 48)"
                    inputMode="numeric"
                    placeholder="0"
                    value={draft}
                    onValueChange={setDraft}
                    className="w-40"
                  />
                  <QavanteButton type="submit" size="sm">
                    Recalcular
                  </QavanteButton>
                  {manual != null && (
                    <span className="text-xs text-neutral-mid">Aplicado: {formatClp(manual)}</span>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </QavanteCard>
  );
}

function PayOption({
  tone,
  label,
  amount,
  hint,
}: {
  tone: "full" | "defer";
  label: string;
  amount: number;
  hint: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "full"
          ? "border-brand-primary/30 bg-brand-primary-50/40"
          : "border-success-500/30 bg-success-500/5",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "full" ? "text-brand-deep" : "text-success-700",
        )}
      >
        {formatClp(amount)}
      </p>
      <p className="mt-1 text-xs text-neutral-mid">{hint}</p>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  unreliable,
}: {
  label: string;
  value: number | null | undefined;
  sub?: string;
  unreliable?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd className="tabular-nums font-medium text-neutral-dark">
        {/* Gotcha CC-API: dato faltante ≠ $0. */}
        {value == null || unreliable ? (
          <span className="text-neutral-mid">— sin dato</span>
        ) : (
          formatClp(value)
        )}
        {sub && !unreliable && (
          <span className="ml-1 text-xs font-normal text-neutral-mid">({sub})</span>
        )}
      </dd>
    </div>
  );
}
