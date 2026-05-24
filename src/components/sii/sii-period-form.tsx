"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { QavanteButton, QavanteCard, QavanteInput } from "@/components/qavante";
import {
  defaultPeriod,
  normalizePeriod,
  siiPeriodFormSchema,
  type SiiPeriodFormValues,
} from "./sii-period-form-schema";

/* Form reusable para consultar SII por período (Sprint C1 PR-Sii3).
   Usado por las 3 vistas RCV/BHE. Mantiene UI consistente y centraliza
   la validación zod. Emite `periodo` normalizado al onSubmit. */

export interface SiiPeriodFormProps {
  /** Llamado al submit con el período validado y normalizado a YYYY-MM. */
  onSubmit: (periodo: string) => void;
  /** Estado de loading externo (el caller controla si el query está corriendo). */
  loading?: boolean;
  /** Período inicial. Default: mes pasado de hoy (los datos del mes vigente
   *  típicamente no están completos en el SII hasta mediados del siguiente). */
  defaultValue?: string;
  /** Override para tests (inyecta una fecha fija). */
  now?: Date;
  /** Hint contextual debajo del input (ej. "Los honorarios del mes vigente…"). */
  hint?: React.ReactNode;
}

export function SiiPeriodForm({
  onSubmit,
  loading = false,
  defaultValue,
  now,
  hint,
}: SiiPeriodFormProps) {
  const initial = defaultValue ?? defaultPeriod(now);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SiiPeriodFormValues>({
    resolver: zodResolver(siiPeriodFormSchema),
    defaultValues: { periodo: initial },
    mode: "onBlur",
  });

  function submit(values: SiiPeriodFormValues) {
    onSubmit(normalizePeriod(values.periodo));
  }

  return (
    <QavanteCard variant="bordered">
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1">
          <label htmlFor="sii-period" className="text-sm font-medium text-neutral-dark">
            Período
          </label>
          <Controller
            control={control}
            name="periodo"
            render={({ field }) => (
              <QavanteInput
                id="sii-period"
                placeholder="2026-04"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.periodo)}
                inputMode="numeric"
                autoComplete="off"
                aria-required="true"
                aria-describedby={errors.periodo ? "sii-period-error" : "sii-period-hint"}
              />
            )}
          />
          {hint && (
            <p id="sii-period-hint" className="text-xs text-neutral-mid">
              {hint}
            </p>
          )}
          {errors.periodo && (
            <p id="sii-period-error" className="text-xs text-danger-500" role="alert">
              {errors.periodo.message}
            </p>
          )}
        </div>
        <QavanteButton type="submit" loading={isSubmitting || loading}>
          <Search className="h-4 w-4" aria-hidden="true" />
          Consultar
        </QavanteButton>
      </form>
    </QavanteCard>
  );
}
