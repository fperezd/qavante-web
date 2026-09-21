"use client";

import Script from "next/script";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { completeFintocWidget, openOfficialFintocWidget } from "@/lib/banco/open-fintoc-widget";

/** Abre el widget oficial de Fintoc. El flujo con consentimiento vive en
 *  `QavanteBankConnectWidget`. */
export function FintocConnectButton() {
  const [guardando, setGuardando] = useState(false);

  const abrirWidget = async () => {
    try {
      await openOfficialFintocWidget({
        onSuccess: (payload) => {
          void (async () => {
            setGuardando(true);
            try {
              const result = await completeFintocWidget(payload);
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
        disabled={guardando}
        className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Guardando banco…" : "Conectar banco"}
      </button>
    </>
  );
}
