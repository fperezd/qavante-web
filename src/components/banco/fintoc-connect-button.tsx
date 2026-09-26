"use client";

import Script from "next/script";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { completeFintocWidget, openOfficialFintocWidget } from "@/lib/banco/open-fintoc-widget";
import { useCompanyScope } from "@/components/shell/company-scope";

/** Abre el widget oficial de Fintoc. El flujo con consentimiento vive en
 *  `QavanteBankConnectWidget`. */
export function FintocConnectButton() {
  const [guardando, setGuardando] = useState(false);
  const { activeCompany } = useCompanyScope();
  const companyRut = activeCompany?.identifiers.find(
    (identifier) => identifier.jurisdiction_code === "CL" && identifier.identifier_scheme === "rut",
  );

  const abrirWidget = async () => {
    const legalEntityId = activeCompany?.id;
    if (!companyRut || !legalEntityId) {
      toast.error("Antes de conectar el banco, declara el RUT de la empresa", {
        description:
          "Ve a Administración → Empresas y confirma el RUT de la sociedad dueña de la cuenta.",
      });
      return;
    }
    try {
      await openOfficialFintocWidget({
        legalEntityId,
        onSuccess: (payload) => {
          void (async () => {
            setGuardando(true);
            try {
              const result = await completeFintocWidget(payload, legalEntityId);
              toast.success(
                `Banco conectado: ${result.accounts} cuentas, ${result.imported} movimientos`,
              );
              window.location.reload();
            } catch (err) {
              toast.error(
                err instanceof ApiError
                  ? apiErrorToUserMessage(err)
                  : err instanceof Error
                    ? err.message
                    : "No se pudo guardar el banco",
              );
            } finally {
              setGuardando(false);
            }
          })();
        },
        onExit: () => {
          toast.message("Cerraste la conexión bancaria");
        },
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? apiErrorToUserMessage(err)
          : err instanceof Error
            ? err.message
            : "No se pudo abrir el widget de Fintoc",
      );
    }
  };

  return (
    <>
      <Script src="https://js.fintoc.com/v1/" strategy="afterInteractive" />
      <button
        type="button"
        onClick={() => void abrirWidget()}
        disabled={guardando || !companyRut}
        className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {guardando
          ? "Guardando banco…"
          : companyRut
            ? "Conectar banco"
            : "Declara el RUT de la empresa"}
      </button>
    </>
  );
}
