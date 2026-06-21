"use client";

import * as React from "react";
import { Lightbulb } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useSuggestRuleForMovement,
  type SuggestRuleResponse,
} from "@/lib/api/classification-rules";

/* Banner §18.7 — Sugerencia de regla derivada del movimiento. Se monta
   dentro del drawer §17 (presentacional puro acepta este componente via
   slot `suggestionBanner`).

   Flujo:
   1) CTA inicial: "Sugerir una regla basada en este movimiento" → click
      llama `POST /api/bank-movements/{id}/suggest-rule` (read-only §18.7;
      el listado de reglas NO crece tras este call).
   2) Una vez recibida la sugerencia, mostramos el preview formateado
      (campo + operador + valor) + 2 botones: "Crear esta regla"
      (abre RuleFormDialog pre-poblado) y "Descartar" (vuelve al state inicial).
   3) Errores se muestran inline; el resto del drawer sigue funcionando
      (la sugerencia es opcional, NO bloquea clasificar). */

const FIELD_LABEL: Record<string, string> = {
  description: "la glosa",
  counterparty_name: "la contraparte",
  reference: "la referencia",
  amount: "el monto",
  currency_code: "la moneda",
  bank_account_id: "la cuenta bancaria",
};

const OPERATOR_LABEL: Record<string, string> = {
  equals: "es igual a",
  contains: "contiene",
  starts_with: "empieza con",
  ends_with: "termina con",
  regex: "matchea",
  greater_than: "es mayor a",
  less_than: "es menor a",
};

export interface SuggestRuleBannerProps {
  movementId: string;
  /** Callback al elegir "Crear esta regla" — el caller abre el RuleFormDialog
   *  con la sugerencia como `initialValues`. */
  onCreateFromSuggestion: (suggestion: SuggestRuleResponse) => void;
  /** Cierra/oculta el banner — por ejemplo cuando el dialog de crear se abrió
   *  o cuando el user descarta. */
  onDismiss?: () => void;
}

export function SuggestRuleBanner({
  movementId,
  onCreateFromSuggestion,
  onDismiss,
}: SuggestRuleBannerProps) {
  const suggest = useSuggestRuleForMovement();
  const [suggestion, setSuggestion] = React.useState<SuggestRuleResponse | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  function handleSuggest() {
    suggest.mutate(movementId, {
      onSuccess: (data) => setSuggestion(data),
    });
  }

  function handleDiscard() {
    setSuggestion(null);
    suggest.reset();
  }

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  if (dismissed) return null;

  /* Caso post-success: tenemos sugerencia para mostrar. */
  if (suggestion) {
    const fieldLabel = suggestion.condition_field
      ? (FIELD_LABEL[suggestion.condition_field] ?? suggestion.condition_field)
      : "la glosa";
    const opLabel = suggestion.operator
      ? (OPERATOR_LABEL[suggestion.operator] ?? suggestion.operator)
      : "contiene";

    return (
      <div className="space-y-2 rounded-xl border border-info-500/40 bg-info-500/5 p-3 text-sm">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-info-600" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-neutral-dark">Sugerencia de regla</p>
            <p className="text-neutral-mid">
              Si <span className="text-neutral-dark">{fieldLabel}</span>{" "}
              <span className="font-medium text-neutral-dark">{opLabel}</span>{" "}
              {suggestion.condition_value && (
                <code className="rounded bg-neutral-light/40 px-1 py-0.5 text-xs">
                  {suggestion.condition_value}
                </code>
              )}
              , crear una regla {suggestion.name ? `llamada "${suggestion.name}"` : ""}.
            </p>
            <p className="text-xs text-neutral-mid">
              Puedes ajustarla antes de guardarla — solo se crea cuando confirmes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <QavanteButton size="sm" onClick={() => onCreateFromSuggestion(suggestion)}>
            Crear esta regla
          </QavanteButton>
          <QavanteButton size="sm" variant="ghost" onClick={handleDiscard}>
            Descartar
          </QavanteButton>
        </div>
      </div>
    );
  }

  /* Caso inicial: CTA para pedir la sugerencia. */
  return (
    <div className="flex items-start gap-2 rounded-md border border-neutral-light bg-neutral-light/20 p-3 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        <p className="text-neutral-dark">
          ¿Qavante puede sugerirte una regla para clasificar movimientos parecidos en el futuro?
        </p>
        {suggest.isError && (
          <p role="alert" className="text-xs text-danger-500">
            {suggest.error instanceof ApiError
              ? apiErrorToUserMessage(suggest.error)
              : "No pudimos generar la sugerencia. Reintenta."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <QavanteButton
            size="sm"
            variant="secondary"
            onClick={handleSuggest}
            disabled={suggest.isPending}
            loading={suggest.isPending}
          >
            {suggest.isPending ? "Generando…" : "Ver sugerencia"}
          </QavanteButton>
          {onDismiss && (
            <QavanteButton size="sm" variant="ghost" onClick={handleDismiss}>
              No, gracias
            </QavanteButton>
          )}
        </div>
      </div>
    </div>
  );
}
