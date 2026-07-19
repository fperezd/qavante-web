"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useSourceConsent,
  useAcceptSourceConsent,
  type ConsentMissingResponse,
  type ConsentResponse,
} from "@/lib/api/source-consent";
import { formatDateLike } from "@/lib/formatters/date";

/* Consentimiento de una fuente (ej. SII). Acceder a la fuente en nombre del
   tenant requiere autorización legal explícita, aparte de la credencial. Sin
   consentimiento válido, las consultas devuelven 403. Muestra el estado y, si
   falta, el texto a aceptar + botón "Autorizar". */

export function SourceConsentCard({ sourceCode, label }: { sourceCode: string; label: string }) {
  const status = useSourceConsent(sourceCode);
  const accept = useAcceptSourceConsent(sourceCode);

  const data = status.data;
  const valid = data?.is_valid ?? false;
  const missing = !valid ? (data as ConsentMissingResponse | undefined) : undefined;
  const granted = valid ? (data as ConsentResponse | undefined) : undefined;

  function autorizar() {
    accept.mutate(
      missing?.consent_text_offered
        ? {
            consent_text: missing.consent_text_offered,
            consent_version: missing.consent_version_offered,
          }
        : undefined,
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>{label}</span>
        </div>
      }
    >
      {status.isLoading ? (
        <p className="text-sm text-neutral-mid">Cargando el estado de la autorización…</p>
      ) : status.isError ? (
        // "No pudimos preguntar" ≠ "falta autorizar": si el GET falla NO afirmamos que falta el
        // consentimiento (invitaría a re-otorgar algo que quizás ya está). Mostramos el error + reintento.
        <div
          className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 p-2.5 text-sm text-danger-500"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p>
              {status.error instanceof ApiError
                ? apiErrorToUserMessage(status.error)
                : "No pudimos consultar el estado de la autorización."}
            </p>
            <QavanteButton size="sm" loading={status.isFetching} onClick={() => status.refetch()}>
              Reintentar
            </QavanteButton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-mid">Autorización para acceder a la fuente</p>
            <QavanteBadge variant={valid ? "success" : "warning"}>
              {valid ? "Autorizada" : "Falta autorizar"}
            </QavanteBadge>
          </div>

          {valid && granted ? (
            <p className="text-xs text-neutral-mid">
              Autorizada
              {granted.accepted_at && <> el {formatDateLike(granted.accepted_at)}</>}
              {granted.expires_at && <> · vence {formatDateLike(granted.expires_at)}</>}.
            </p>
          ) : (
            <>
              {missing?.consent_text_offered && (
                <p className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-neutral-dark">
                  {missing.consent_text_offered}
                </p>
              )}

              {accept.isSuccess && (
                <div className="flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-500/10 p-2.5 text-sm text-success-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <p>Autorización registrada. Sincroniza para traer tus datos.</p>
                </div>
              )}
              {accept.isError && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 p-2.5 text-sm text-danger-500"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <p>
                    {accept.error instanceof ApiError
                      ? apiErrorToUserMessage(accept.error)
                      : "No pudimos registrar la autorización. Intenta de nuevo."}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <QavanteButton size="sm" loading={accept.isPending} onClick={autorizar}>
                  Autorizar acceso
                </QavanteButton>
              </div>
            </>
          )}
        </div>
      )}
    </QavanteCard>
  );
}
