"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileCheck2,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type {
  OperationPlanChecklistItemView,
  OperationPlanTone,
  OperationPlanView,
} from "./operation-plan-model";

export interface OperationPlanPanelProps {
  plan: OperationPlanView | null;
  loading?: boolean;
  errorMessage?: string | null;
  requestingApproval?: boolean;
  requestApprovalError?: string | null;
  onRetry?: () => void;
  /** Control inyectado por el boundary live; la vista no conoce el transporte. */
  requestApprovalControl?: React.ReactNode;
}

const BADGE_VARIANT: Record<OperationPlanTone, "default" | "info" | "warning" | "success"> = {
  neutral: "default",
  info: "info",
  warning: "warning",
  success: "success",
};

export function OperationPlanPanel({
  plan,
  loading = false,
  errorMessage = null,
  requestingApproval = false,
  requestApprovalError = null,
  onRetry,
  requestApprovalControl,
}: OperationPlanPanelProps) {
  if (loading) {
    return (
      <section aria-label="Plan operativo" aria-busy="true" className="space-y-2">
        <p className="text-sm text-neutral-mid">Leyendo el estado del plan operativo…</p>
        <div className="h-28 animate-pulse rounded-xl bg-neutral-light/30" aria-hidden="true" />
      </section>
    );
  }

  if (errorMessage) {
    return (
      <QavanteCard variant="bordered">
        <div role="alert" className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-dark">No pudimos mostrar el plan operativo</p>
            <p className="mt-1 text-sm text-neutral-mid">{errorMessage}</p>
            {onRetry && (
              <QavanteButton className="mt-3" variant="secondary" size="sm" onClick={onRetry}>
                Actualizar plan
              </QavanteButton>
            )}
          </div>
        </div>
      </QavanteCard>
    );
  }

  if (!plan) return null;

  if (plan.kind === "absent") {
    return (
      <QavanteCard variant="bordered">
        <section
          aria-labelledby={`operation-plan-${plan.reason}`}
          className="flex items-start gap-3"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div>
            <p id={`operation-plan-${plan.reason}`} className="font-semibold text-neutral-dark">
              {plan.title}
            </p>
            <p className="mt-1 text-sm text-neutral-mid">{plan.description}</p>
            {plan.reasons.length > 0 && (
              <ul
                className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-mid"
                aria-label="Causas informadas por Qavante"
              >
                {plan.reasons.map((reason, index) => (
                  <li key={`${index}-${reason}`}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </QavanteCard>
    );
  }

  return (
    <section aria-labelledby="operation-plan-title" className="space-y-3">
      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Plan operativo
            </p>
            <h4
              id="operation-plan-title"
              className="mt-1 text-base font-semibold text-neutral-dark"
            >
              {plan.alternativeTitle}
            </h4>
            <p className="mt-1 break-all text-xs text-neutral-mid">Plan {plan.planId}</p>
            {plan.selectedAtLabel && (
              <p className="mt-1 text-xs text-neutral-mid">
                Alternativa seleccionada el {plan.selectedAtLabel}
              </p>
            )}
            {plan.selectionRationale && (
              <p className="mt-2 text-sm text-neutral-mid">Motivo: {plan.selectionRationale}</p>
            )}
          </div>
          <QavanteBadge variant={BADGE_VARIANT[plan.statusTone]}>{plan.statusLabel}</QavanteBadge>
        </div>

        <p className="mt-3 text-sm text-neutral-mid">{plan.statusDescription}</p>
        {plan.readOnly && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Sólo lectura
          </p>
        )}

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Costo" value={plan.costLabel} />
          <Detail label="Evidencia" value={plan.evidenceLabel} />
          <Detail label="Vigencia" value={plan.validityLabel} />
        </dl>
      </QavanteCard>

      {plan.errors.length > 0 && (
        <QavanteCard variant="bordered">
          <h5 className="font-semibold text-neutral-dark">Errores informados por el plan</h5>
          <ul className="mt-3 space-y-2" aria-label="Errores del plan operativo">
            {plan.errors.map((error) => (
              <li key={error.id} className="flex items-start gap-2 text-sm">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-neutral-dark">{error.label}</p>
                  {error.detail && <p className="text-neutral-mid">{error.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}

      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="font-semibold text-neutral-dark">
            Checklist antes de solicitar aprobación
          </h5>
          <span className="text-xs text-neutral-mid">{checklistSummary(plan)}</span>
        </div>

        {plan.checklistCompletionStatus === "not_evaluated" ? (
          <div className="mt-3 space-y-2">
            <p className="flex items-start gap-2 text-sm text-neutral-mid">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Qavante informó que el cumplimiento del checklist no fue evaluado.
            </p>
            {plan.checklist.length > 0 ? (
              <ul className="space-y-2" aria-label="Requisitos del plan">
                {plan.checklist.map((item) => (
                  <ChecklistItem key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-mid">No se informaron requisitos.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 text-sm text-neutral-mid">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>No solicitaremos aprobación hasta que Qavante informe los requisitos y su estado.</p>
          </div>
        )}

        {requestApprovalError && (
          <p role="alert" className="mt-3 text-sm font-medium text-warning-700">
            {requestApprovalError}
          </p>
        )}

        {!plan.readOnly && (
          <div className="mt-4 border-t border-neutral-light/60 pt-4">
            {plan.canRequestApproval && requestApprovalControl ? (
              requestApprovalControl
            ) : (
              <QavanteButton size="sm" disabled loading={requestingApproval}>
                Solicitar aprobación
              </QavanteButton>
            )}
            {!plan.canRequestApproval && (
              <p className="mt-2 text-xs text-neutral-mid">
                La solicitud se habilita sólo con evidencia verificable y autorización vigente.
              </p>
            )}
          </div>
        )}
      </QavanteCard>
    </section>
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

function ChecklistItem({ item }: { item: OperationPlanChecklistItemView }) {
  const Icon =
    item.state === "complete"
      ? CheckCircle2
      : item.state === "pending"
        ? Clock
        : item.state === "blocked"
          ? AlertCircle
          : CircleDashed;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          item.state === "complete"
            ? "text-success-700"
            : item.state === "blocked"
              ? "text-warning-700"
              : "text-neutral-mid",
        )}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-medium text-neutral-dark">{item.label}</p>
        {item.detail && <p className="text-xs text-neutral-mid">{item.detail}</p>}
      </div>
    </li>
  );
}

function checklistSummary(plan: Extract<OperationPlanView, { kind: "present" }>): string {
  return plan.checklistCompletionStatus === "not_evaluated"
    ? "Cumplimiento no evaluado"
    : "Estado no informado";
}
