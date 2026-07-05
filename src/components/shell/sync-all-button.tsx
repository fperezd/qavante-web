"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useTriggerOnboardingSync, type OnboardingSyncResponse } from "@/lib/api/onboarding-status";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { cn } from "@/lib/utils";

/* Botón "Actualizar" global del header (patrón Chipax: un solo botón que trae
   todo, en vez de sincronizar fuente por fuente). Dispara `POST /api/onboarding/sync`
   (SII + banco, las dos fuentes pesadas; acepta cookie) y gira mientras corre.

   Al terminar invalida las queries → las pantallas abiertas se refrescan con lo
   nuevo. La sincronización del backend es asíncrona (tarda minutos), por eso el
   toast avisa que los datos llegan "en unos minutos".

   Límites conocidos (escalados a CC-API, ver STATE_OF_THE_TRAIN):
   - No incluye BUK/TGR/Dirección del Trabajo (falta un `sync-all` real).
   - No "gira solo" cuando corre el cron (falta un estado `syncing` en el
     contrato de fuentes). Hoy gira solo mientras el usuario lo dispara. */
export function SyncAllButton() {
  const qc = useQueryClient();
  const sync = useTriggerOnboardingSync();

  function actualizar() {
    if (sync.isPending) return;
    sync.mutate(undefined, {
      onSuccess: (res) => {
        // Refresca todo lo que esté en pantalla con lo que ya haya llegado.
        qc.invalidateQueries();
        const failed = describeFailures(res);
        if (failed) {
          toast.warning("Actualización iniciada con avisos", { description: failed });
        } else {
          toast.success("Actualización iniciada", {
            description:
              "Estamos trayendo tus datos del SII y del banco. Se actualizan en unos minutos.",
          });
        }
      },
      onError: (err) => {
        toast.error("No pudimos actualizar", {
          description:
            err instanceof ApiError
              ? apiErrorToUserMessage(err)
              : "Intenta de nuevo en unos segundos.",
        });
      },
    });
  }

  const spinning = sync.isPending;

  return (
    <button
      type="button"
      onClick={actualizar}
      disabled={spinning}
      aria-busy={spinning}
      aria-label={spinning ? "Actualizando datos…" : "Actualizar datos (SII y banco)"}
      title={spinning ? "Actualizando…" : "Actualizar datos (SII y banco)"}
      className={cn(
        "hidden h-8 w-8 items-center justify-center rounded-full text-surface shadow-sm transition-colors md:flex",
        "bg-success-600 hover:bg-success-700 disabled:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2",
      )}
    >
      <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} aria-hidden="true" />
    </button>
  );
}

/** Resume las fuentes que fallaron para el toast, o null si ninguna falló. */
function describeFailures(res: OnboardingSyncResponse): string | null {
  const failed: string[] = [];
  if (res.sources.sii?.status === "failed") failed.push("SII");
  if (res.sources.bank?.status === "failed") failed.push("banco");
  if (failed.length === 0) return null;
  return `No pudimos actualizar: ${failed.join(" y ")}. Revisa la conexión en Administración.`;
}
