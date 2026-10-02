"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useCompanyHasConnectedBank } from "@/lib/api/fintoc-connections";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useAcceptSourceConsent,
  useSourceConsent,
  type ConsentMissingResponse,
} from "@/lib/api/source-consent";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";
import { useCompanyScope } from "@/components/shell/company-scope";
import { explicitCompanyRequestHeaders } from "@/lib/company/active-company";

interface FintocSyncResponse {
  status: string;
  accounts: number;
  imported: number;
  per_account?: Array<{
    institution_name?: string;
    sync_error?: { message?: string };
  }>;
}

/** Consentimiento en Qavante + pull de cartola; el alta del banco es el widget oficial. */
export function FintocBankActions() {
  const { activeCompanyId } = useCompanyScope();
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const accept = useAcceptSourceConsent(BANK_SOURCE_CODE);
  const [syncing, setSyncing] = useState(false);
  const hasRealConnection = useCompanyHasConnectedBank(activeCompanyId) === true;

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
    if (!activeCompanyId) return;
    setSyncing(true);
    try {
      const result = await api.post<FintocSyncResponse>("/api/fintoc/sync", {
        headers: explicitCompanyRequestHeaders(activeCompanyId),
      });
      const failures = (result.per_account ?? [])
        .filter((item) => item.sync_error)
        .map(
          (item) =>
            `${item.institution_name ?? "Banco"}: ${item.sync_error?.message ?? "falló la actualización"}`,
        );
      if (result.status === "ok") {
        toast.success(`Cuentas listas: ${result.accounts} cuentas, ${result.imported} movimientos`);
        window.location.reload();
      } else if (result.status === "partial") {
        toast.warning(`Se actualizaron ${result.accounts} cuentas; algunas conexiones fallaron.`, {
          description: failures.join(" "),
        });
        window.location.reload();
      } else {
        toast.error("No se pudo actualizar ninguna conexión Fintoc.", {
          description: failures.join(" "),
        });
      }
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

  return hasRealConnection ? (
    <button
      type="button"
      onClick={() => void traerCuentas()}
      disabled={syncing}
      className="rounded-full border border-neutral-dark px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-60"
    >
      {syncing ? "Actualizando…" : "Actualizar cuentas"}
    </button>
  ) : null;
}
