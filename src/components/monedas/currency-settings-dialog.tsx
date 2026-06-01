"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useUpdateCompanyCurrencySettings,
  type CompanyCurrencySettings,
  type Currency,
} from "@/lib/api/currencies";
import { CurrencyCodeSelect } from "./currency-code-select";
import {
  FX_SOURCES,
  settingsSchema,
  settingsToForm,
  formToRequest,
  type SettingsFormValues,
} from "./currency-settings-form";

/* Editor de Ajustes de moneda — Addendum §15.4/§15.6 + §20 (PATCH owner/admin).
   Patrón establecido: Base UI Dialog + react-hook-form + zod (igual que
   invite-user-dialog). Lazy-loaded desde la page (next/dynamic, ssr:false)
   para no inflar First Load JS — admin-only.

   Schema + transforms en `./currency-settings-form` (sin React, testeable
   en vitest unit). El backend re-valida (es la verdad). 403 si rol sin
   permiso (§20) — se renderiza via apiErrorToUserMessage. */

export interface CurrencySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Settings actuales (puede ser null si todavía no se sembraron — §15.4). */
  settings: CompanyCurrencySettings | null;
  /** Catálogo de monedas para los selectores. */
  currencies: Currency[];
}

export function CurrencySettingsDialog({
  open,
  onOpenChange,
  settings,
  currencies,
}: CurrencySettingsDialogProps) {
  const update = useUpdateCompanyCurrencySettings();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsToForm(settings),
    mode: "onBlur",
  });

  /* Re-sincronizar el form si cambia el snapshot de settings (post-PATCH o
     primera carga llegando después del montaje del dialog). */
  React.useEffect(() => {
    if (open) {
      reset(settingsToForm(settings));
      setSubmitError(null);
    }
  }, [open, settings, reset]);

  const indexedEnabled = watch("indexed_unit_enabled");
  const functionalCode = watch("functional_currency_code");
  const reportingCodes = watch("reporting_currency_codes");
  const defaultReporting = watch("default_reporting_currency_code");

  /* #5: si el "default de reporte" deja de estar entre las monedas de reporte
     (el user la destildó), limpiarlo. Sin esto queda un valor stale invisible
     en el select (el submit lo atrapaba con un refine, pero el usuario no veía
     por qué). Converge: al ponerlo en "" el guard no vuelve a dispararse. */
  const reportingKey = reportingCodes.join(",");
  React.useEffect(() => {
    if (defaultReporting && !reportingCodes.includes(defaultReporting)) {
      setValue("default_reporting_currency_code", "", { shouldDirty: true, shouldValidate: true });
    }
    // reportingKey representa reportingCodes de forma estable (evita re-correr
    // en cada render por una nueva referencia del array de watch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportingKey, defaultReporting, setValue]);

  async function onSubmit(values: SettingsFormValues) {
    setSubmitError(null);
    try {
      await update.mutateAsync(formToRequest(values));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(apiErrorToUserMessage(err));
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  const title = settings ? "Editar ajustes de moneda" : "Configurar monedas";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            La moneda funcional es la principal de tu empresa. Las monedas de reporte se usan para
            ver los mismos números en otras monedas. Puedes activar la unidad indexada (UF / UTM) si
            la usas en Chile.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="settings-functional"
                className="text-sm font-medium text-neutral-dark"
              >
                Moneda funcional
              </label>
              <Controller
                control={control}
                name="functional_currency_code"
                render={({ field }) => (
                  <CurrencyCodeSelect
                    id="settings-functional"
                    value={field.value}
                    onChange={field.onChange}
                    currencies={currencies}
                    filterType="fiat"
                    invalid={Boolean(errors.functional_currency_code)}
                    required
                    aria-describedby={
                      errors.functional_currency_code ? "settings-functional-error" : undefined
                    }
                  />
                )}
              />
              {errors.functional_currency_code && (
                <p id="settings-functional-error" className="text-xs text-danger-500" role="alert">
                  {errors.functional_currency_code.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <fieldset
                aria-describedby={
                  errors.reporting_currency_codes ? "settings-reporting-error" : undefined
                }
              >
                <legend className="text-sm font-medium text-neutral-dark">
                  Monedas de reporte
                </legend>
                <p className="mb-2 text-xs text-neutral-mid">
                  Las que quieres ver junto a la funcional en tus reportes.
                </p>
                <Controller
                  control={control}
                  name="reporting_currency_codes"
                  render={({ field }) => (
                    <ReportingCheckboxGroup
                      value={field.value}
                      onChange={field.onChange}
                      currencies={currencies}
                      excludeCode={functionalCode}
                    />
                  )}
                />
              </fieldset>
              {errors.reporting_currency_codes && (
                <p id="settings-reporting-error" className="text-xs text-danger-500" role="alert">
                  {errors.reporting_currency_codes.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="settings-default-reporting"
                className="text-sm font-medium text-neutral-dark"
              >
                Moneda de reporte por defecto <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="default_reporting_currency_code"
                render={({ field }) => (
                  <CurrencyCodeSelect
                    id="settings-default-reporting"
                    value={field.value}
                    onChange={field.onChange}
                    currencies={currencies.filter((c) => reportingCodes.includes(c.code))}
                    placeholder="Sin moneda por defecto"
                    invalid={Boolean(errors.default_reporting_currency_code)}
                    allowEmpty
                    aria-describedby={
                      errors.default_reporting_currency_code
                        ? "settings-default-reporting-error"
                        : undefined
                    }
                  />
                )}
              />
              {errors.default_reporting_currency_code && (
                <p
                  id="settings-default-reporting-error"
                  className="text-xs text-danger-500"
                  role="alert"
                >
                  {errors.default_reporting_currency_code.message}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-neutral-light bg-neutral-light/20 p-3">
              <Controller
                control={control}
                name="indexed_unit_enabled"
                render={({ field }) => (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-light text-brand-primary focus:ring-brand-primary"
                    />
                    <span>
                      <span className="font-medium text-neutral-dark">
                        Usar una unidad indexada (UF / UTM)
                      </span>
                      <span className="block text-xs text-neutral-mid">
                        Útil en Chile para contratos en UF o cálculos tributarios en UTM.
                      </span>
                    </span>
                  </label>
                )}
              />
              {indexedEnabled && (
                <div className="space-y-1 pl-6">
                  <label
                    htmlFor="settings-indexed-unit"
                    className="text-sm font-medium text-neutral-dark"
                  >
                    Unidad indexada
                  </label>
                  <Controller
                    control={control}
                    name="indexed_unit_currency_code"
                    render={({ field }) => (
                      <CurrencyCodeSelect
                        id="settings-indexed-unit"
                        value={field.value}
                        onChange={field.onChange}
                        currencies={currencies}
                        filterType="indexed_unit"
                        invalid={Boolean(errors.indexed_unit_currency_code)}
                        required
                        aria-describedby={
                          errors.indexed_unit_currency_code
                            ? "settings-indexed-unit-error"
                            : undefined
                        }
                      />
                    )}
                  />
                  {errors.indexed_unit_currency_code && (
                    <p
                      id="settings-indexed-unit-error"
                      className="text-xs text-danger-500"
                      role="alert"
                    >
                      {errors.indexed_unit_currency_code.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="settings-fx-source" className="text-sm font-medium text-neutral-dark">
                Fuente de tipo de cambio <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="default_exchange_rate_source"
                render={({ field }) => (
                  <select
                    id="settings-fx-source"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className={cn(
                      "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                    )}
                  >
                    <option value="">Sin preferencia</option>
                    {FX_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s === "BCCH" ? "Banco Central de Chile" : "SII"}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
              >
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
                Cancelar
              </Dialog.Close>
              <QavanteButton type="submit" loading={isSubmitting}>
                Guardar cambios
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ReportingCheckboxGroupProps {
  value: string[];
  onChange: (value: string[]) => void;
  currencies: Currency[];
  excludeCode?: string;
}

function ReportingCheckboxGroup({
  value,
  onChange,
  currencies,
  excludeCode,
}: ReportingCheckboxGroupProps) {
  const fiats = React.useMemo(
    () =>
      currencies.filter((c) => c.active && c.currency_type === "fiat" && c.code !== excludeCode),
    [currencies, excludeCode],
  );

  function toggle(code: string) {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  }

  if (fiats.length === 0) {
    return (
      <p className="text-xs text-neutral-mid">No hay otras monedas para elegir como reporte.</p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {fiats.map((c) => (
        <li key={c.code}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(c.code)}
              onChange={() => toggle(c.code)}
              className="h-4 w-4 rounded border-neutral-light text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-neutral-dark">{c.code}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
