"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, History, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteButton, QavanteCard, QavanteInlineError } from "@/components/qavante";
import type { PayrollSystemEra } from "@/lib/api/payroll-system";
import {
  PAYROLL_SYSTEM_OPTIONS,
  describeEra,
  describeStatus,
  isPayrollSystemId,
} from "./payroll-system-form";

/* Selector del sistema de remuneraciones de la empresa activa (CC-API ADR-0122).

   Vista PRESENTACIONAL (props-only) para poder probarla sin router ni react-query;
   el cableado vive en `payroll-system-settings-view`.

   Tres cosas que esta pantalla no hace:

   - **No muestra "BUK" cuando la empresa no eligió.** Un pendiente se ve como
     pendiente: suponer BUK es exactamente el defecto que este trabajo cierra.
   - **No habla de "la cuenta".** El sistema es de la EMPRESA: si hay varias, el
     encabezado dice de cuál se está configurando, con su nombre.
   - **No esconde la limitación de Talana.** Declararlo sirve (deja de intentar BUK),
     pero no trae la planilla todavía, y lo dice. */

export interface PayrollSystemCardViewProps {
  /** Nombre de la empresa activa, para que nadie configure a ciegas. */
  companyName?: string | null;
  /** La cuenta tiene más de una empresa → hay que ser explícito sobre cuál es. */
  multipleCompanies?: boolean;
  declared: boolean;
  payrollSystem?: string | null;
  adapterState?: string | null;
  effectiveFromPeriod?: string | null;
  history?: readonly PayrollSystemEra[];
  /** Selección en curso del formulario (puede diferir de lo declarado). */
  selected: string;
  onSelect: (value: string) => void;
  /** Mes de vigencia, en formato de `<input type="month">` (`YYYY-MM`). */
  monthInput: string;
  onMonthInputChange: (value: string) => void;
  onSave: () => void;
  canSave: boolean;
  saving?: boolean;
  loading?: boolean;
  /** Error del GET. Si es 409 por falta de empresa activa, `scopeMissing`. */
  error?: unknown;
  /** El backend se abstuvo por falta de empresa activa. */
  scopeMissing?: boolean;
  saveError?: unknown;
  saved?: boolean;
  /** El usuario no es owner/admin: puede ver, no cambiar. */
  readOnly?: boolean;
  onRetry?: () => void;
}

const TONE_ICON = {
  pending: AlertTriangle,
  ok: CheckCircle2,
  info: Info,
} as const;

const TONE_CLASS = {
  pending: "border-warning-500/30 bg-warning-500/5",
  ok: "border-success-500/30 bg-success-500/5",
  info: "border-border bg-surface-muted",
} as const;

export function PayrollSystemCardView({
  companyName,
  multipleCompanies = false,
  declared,
  payrollSystem,
  adapterState,
  effectiveFromPeriod,
  history = [],
  selected,
  onSelect,
  monthInput,
  onMonthInputChange,
  onSave,
  canSave,
  saving = false,
  loading = false,
  error,
  scopeMissing = false,
  saveError,
  saved = false,
  readOnly = false,
  onRetry,
}: PayrollSystemCardViewProps) {
  const status = describeStatus({
    declared,
    payroll_system: payrollSystem,
    adapter_state: adapterState,
    effective_from_period: effectiveFromPeriod,
  });
  const StatusIcon = TONE_ICON[status.tone];
  /* Sólo las eras ya cerradas son "historia": la vigente ya está arriba, repetirla
     haría parecer que hubo dos cambios donde hubo uno. */
  const pastEras = history.filter((era) => era.effective_to_period);

  if (scopeMissing) {
    return (
      <QavanteCard variant="bordered">
        <div className="flex items-start gap-3" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-500" />
          <div>
            <h3 className="text-sm font-semibold text-neutral-dark">
              Elige una empresa para configurar sus remuneraciones
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">
              El sistema de remuneraciones es de cada empresa, no de la cuenta: una puede usar BUK y
              otra subir su nómina a mano. Selecciona la empresa arriba y vuelve a entrar.
            </p>
          </div>
        </div>
      </QavanteCard>
    );
  }

  if (loading) {
    return (
      <QavanteCard variant="bordered">
        <div className="space-y-3" aria-hidden="true">
          <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-light/40" />
          <div className="h-20 animate-pulse rounded-xl bg-neutral-light/30" />
        </div>
      </QavanteCard>
    );
  }

  if (error) {
    return (
      <QavanteCard variant="bordered">
        <QavanteInlineError error={error} what="tu sistema de remuneraciones" onRetry={onRetry} />
      </QavanteCard>
    );
  }

  return (
    <QavanteCard variant="bordered">
      <div className="space-y-5">
        {multipleCompanies && companyName && (
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
            Estás configurando {companyName}
          </p>
        )}

        <div
          className={cn("flex items-start gap-3 rounded-xl border p-4", TONE_CLASS[status.tone])}
        >
          <StatusIcon
            className={cn(
              "mt-0.5 h-5 w-5 flex-shrink-0",
              status.tone === "pending" && "text-warning-500",
              status.tone === "ok" && "text-success-500",
              status.tone === "info" && "text-neutral-mid",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-dark">{status.title}</h3>
            <p className="mt-1 text-sm text-neutral-mid">{status.detail}</p>
          </div>
        </div>

        <fieldset disabled={readOnly} className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-dark">
            ¿Con qué sistema pagas tus sueldos?
          </legend>
          <ul role="radiogroup" aria-label="Sistema de remuneraciones" className="space-y-2">
            {PAYROLL_SYSTEM_OPTIONS.map((option) => {
              const active = selected === option.id;
              const current = isPayrollSystemId(payrollSystem) && payrollSystem === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={readOnly}
                    onClick={() => onSelect(option.id)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-brand-primary bg-brand-primary-50 shadow-sm"
                        : "border-border hover:border-brand-primary/50 hover:bg-surface-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-dark">{option.label}</span>
                      <span className="mt-0.5 block text-sm text-neutral-mid">
                        {option.description}
                      </span>
                    </span>
                    {current && (
                      <span className="flex-shrink-0 rounded-full bg-neutral-light/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                        Actual
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-1">
            <label
              htmlFor="payroll-system-effective-from"
              className="block text-sm font-medium text-neutral-dark"
            >
              Rige desde
            </label>
            <input
              id="payroll-system-effective-from"
              type="month"
              value={monthInput}
              disabled={readOnly}
              onChange={(e) => onMonthInputChange(e.target.value)}
              className={cn(
                "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark sm:w-56",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <p className="text-xs text-neutral-mid">
              Los meses anteriores conservan el sistema del que vinieron: cambiar acá no reescribe
              tu historia de nómina.
            </p>
          </div>
        </fieldset>

        {readOnly && (
          <p className="text-sm text-neutral-mid">
            Sólo quien administra la empresa puede cambiar el sistema de remuneraciones.
          </p>
        )}

        {saveError != null && <QavanteInlineError error={saveError} what="el cambio de sistema" />}

        {saved && !saving && (
          <p role="status" className="text-sm text-success-500">
            Guardado. Qavante ya actúa según lo que elegiste.
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end">
            <QavanteButton type="button" onClick={onSave} disabled={!canSave || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </QavanteButton>
          </div>
        )}

        {pastEras.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-dark">
              <History className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
              Antes usabas
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-neutral-mid">
              {pastEras.map((era) => (
                <li key={`${era.payroll_system}-${era.effective_from_period}`}>
                  {describeEra(era)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </QavanteCard>
  );
}
