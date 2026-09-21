"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useAcceptSourceConsent,
  useSourceConsent,
  type ConsentMissingResponse,
} from "@/lib/api/source-consent";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";

interface FintocSyncResponse {
  status: string;
  accounts: number;
  imported: number;
}

/** Consentimiento en Qavante + pull de cartola; el alta del banco es el widget oficial. */
export function FintocBankActions() {
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const accept = useAcceptSourceConsent(BANK_SOURCE_CODE);
  const [syncing, setSyncing] = useState(false);

  const valid = consent.data?.is_valid === true;
  const missing = !valid ? (consent.data as ConsentMissingResponse | undefined) : undefined;

  const autorizar = () => {
    accept.mutate(
      missing?.consent_text_offered
        ? {
            consent_text: missing.consent_text_offered,
            consent_version: missing.consent_version_offered,
          }
        : undefined,
      {
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "No se pudo guardar el consentimiento");
        },
      },
    );
  };

  const traerCuentas = async () => {
    setSyncing(true);
    try {
      const result = await api.post<FintocSyncResponse>("/api/fintoc/sync");
      toast.success(`Cuentas listas: ${result.accounts} cuentas, ${result.imported} movimientos`);
      window.location.reload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? apiErrorToUserMessage(err)
          : err instanceof Error
            ? err.message
            : "No se pudieron pedir las cuentas al agregador";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  if (!valid) {
    return (
      <button
        type="button"
        onClick={autorizar}
        disabled={consent.isLoading || accept.isPending}
        className="rounded-full border border-neutral-dark px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-60"
      >
        {accept.isPending ? "Guardando autorización…" : "Autorizar acceso"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void traerCuentas()}
      disabled={syncing}
      className="rounded-full border border-neutral-dark px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-60"
    >
      {syncing ? "Actualizando…" : "Actualizar cuentas"}
    </button>
  );
}
