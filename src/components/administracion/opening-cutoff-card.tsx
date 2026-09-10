"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import {
  type OpeningCutoffImpact,
  type OpeningCutoffStatus,
  useApplyOpeningCutoff,
  useOpeningCutoffStatus,
  usePreviewOpeningCutoff,
  useRevertOpeningCutoff,
} from "@/lib/api/opening-cutoff";
import { OpeningCutoffConfirmDialog } from "./opening-cutoff-confirm-dialog";
import { formatCount } from "@/lib/formatters/count";

function formatIsoDate(value?: string | null): string {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}

interface OpeningCutoffCardViewProps {
  status?: OpeningCutoffStatus;
  loading?: boolean;
  error?: unknown;
  cutoffDate: string;
  preview?: OpeningCutoffImpact;
  previewPending?: boolean;
  actionPending?: boolean;
  onCutoffDateChange: (value: string) => void;
  onPreview: () => void;
  onApply: () => void;
  onRevert: () => void;
  onRetry: () => void;
}

export function OpeningCutoffCardView({
  status,
  loading = false,
  error,
  cutoffDate,
  preview,
  previewPending = false,
  actionPending = false,
  onCutoffDateChange,
  onPreview,
  onApply,
  onRevert,
  onRetry,
}: OpeningCutoffCardViewProps) {
  const active = status?.active === true;
  const workflowImpactTotal = preview
    ? preview.receivables_saldadas +
      preview.payables_saldadas +
      preview.movimientos_clasificacion_retirados +
      preview.movimientos_conciliacion_retirados
    : 0;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Corte de apertura
          </span>
          {active && <QavanteBadge variant="success">Activo</QavanteBadge>}
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-neutral-mid">Cargando configuración…</p>
      ) : error ? (
        <QavanteInlineError error={error} what="el corte de apertura" onRetry={onRetry} />
      ) : active ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-success-500/30 bg-success-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-neutral-dark">
                Historial operativo cerrado hasta el {formatIsoDate(status?.cutoff_date)}
              </p>
              <p className="mt-1 text-xs text-neutral-mid">
                Aplicado el {formatIsoDate(status?.applied_at)} para esta empresa. Los datos siguen
                auditables, pero ya no inflan las bandejas pendientes.
              </p>
            </div>
          </div>
          <QavanteButton
            type="button"
            variant="danger"
            size="sm"
            disabled={actionPending}
            onClick={onRevert}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Deshacer corte
          </QavanteButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-dark">
              Define desde qué fecha Qavante administrará los pendientes diarios de esta empresa.
            </p>
            <p className="mt-1 text-xs text-neutral-mid">
              El historial anterior se conserva, pero sale de las colas. El corte no crea
              clasificaciones ni conciliaciones ficticias. Tampoco presume pagadas obligaciones
              sensibles como impuestos, Previred y remuneraciones.
            </p>
          </div>

          <div className="max-w-xs">
            <label htmlFor="opening-cutoff-date" className="mb-1 block text-sm font-medium">
              Cerrar historial hasta
            </label>
            <QavanteInput
              id="opening-cutoff-date"
              variant="date"
              value={cutoffDate}
              onValueChange={onCutoffDateChange}
              disabled={previewPending || actionPending}
            />
          </div>

          <QavanteButton
            type="button"
            variant="secondary"
            size="sm"
            loading={previewPending}
            disabled={!cutoffDate || actionPending}
            onClick={onPreview}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Previsualizar impacto
          </QavanteButton>

          {preview && (
            <div
              className="rounded-lg border border-border bg-neutral-light/20 p-4"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-neutral-dark">
                {formatCount(workflowImpactTotal)} cambios de flujo previstos
              </p>
              <p className="mt-1 text-xs text-neutral-mid">
                Son conteos por flujo, no registros únicos: un movimiento puede salir de Clasificar
                y Conciliar al mismo tiempo.
              </p>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-mid">Cuentas por cobrar cerradas</dt>
                  <dd className="font-semibold">{formatCount(preview.receivables_saldadas)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-mid">Cuentas por pagar cerradas</dt>
                  <dd className="font-semibold">{formatCount(preview.payables_saldadas)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-mid">Movimientos fuera de Clasificar</dt>
                  <dd className="font-semibold">
                    {formatCount(preview.movimientos_clasificacion_retirados)}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-mid">Movimientos fuera de Conciliar</dt>
                  <dd className="font-semibold">
                    {formatCount(preview.movimientos_conciliacion_retirados)}
                  </dd>
                </div>
              </dl>
              <QavanteButton
                className="mt-4"
                type="button"
                size="sm"
                disabled={actionPending}
                onClick={onApply}
              >
                Aplicar este corte
              </QavanteButton>
            </div>
          )}
        </div>
      )}
    </QavanteCard>
  );
}

export function OpeningCutoffCard() {
  const status = useOpeningCutoffStatus();
  const preview = usePreviewOpeningCutoff();
  const apply = useApplyOpeningCutoff();
  const revert = useRevertOpeningCutoff();
  const [cutoffDate, setCutoffDate] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState<"apply" | "revert" | null>(null);

  function changeDate(value: string) {
    setCutoffDate(value);
    preview.reset();
  }

  function applyCutoff() {
    apply.mutate(
      { cutoff_date: cutoffDate, keep_open: [] },
      {
        onSuccess: () => {
          setConfirmAction(null);
          preview.reset();
          toast.success("Corte de apertura aplicado", {
            description: "Las bandejas de esta empresa ya reflejan el nuevo inicio operativo.",
          });
        },
      },
    );
  }

  function revertCutoff() {
    revert.mutate(undefined, {
      onSuccess: () => {
        setConfirmAction(null);
        toast.success("Corte de apertura deshecho", {
          description: "Los estados anteriores fueron restaurados.",
        });
      },
    });
  }

  const mutationError = preview.error ?? apply.error ?? revert.error;

  return (
    <>
      <OpeningCutoffCardView
        status={status.data}
        loading={status.isLoading}
        error={status.error ?? mutationError}
        cutoffDate={cutoffDate}
        preview={preview.data}
        previewPending={preview.isPending}
        actionPending={apply.isPending || revert.isPending}
        onCutoffDateChange={changeDate}
        onPreview={() => preview.mutate({ cutoff_date: cutoffDate, keep_open: [] })}
        onApply={() => setConfirmAction("apply")}
        onRevert={() => setConfirmAction("revert")}
        onRetry={() => {
          if (status.isError) void status.refetch();
          else {
            preview.reset();
            apply.reset();
            revert.reset();
          }
        }}
      />
      <OpeningCutoffConfirmDialog
        action={confirmAction ?? "apply"}
        cutoffDate={cutoffDate}
        open={confirmAction !== null}
        pending={apply.isPending || revert.isPending}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        onConfirm={confirmAction === "revert" ? revertCutoff : applyCutoff}
      />
    </>
  );
}
