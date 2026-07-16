"use client";

import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREVIRED_SOURCE_CODE, usePreviredCredential } from "@/lib/api/credentials";
import { useSourceConsent } from "@/lib/api/source-consent";
import { estadoConexionPrevired } from "./previred-estado-conexion-model";

/* Resumen de los dos pasos de Previred (clave + autorización) en una sola línea. La lógica vive
   en `previred-estado-conexion-model.ts` (pura, con unit tests). */

const ICONO = { ok: CheckCircle2, falta: CircleAlert, neutro: Info } as const;

const TONO = {
  ok: "border-success-200 bg-success-50 text-success-700",
  falta: "border-warning-200 bg-warning-50 text-warning-700",
  neutro: "border-neutral-light bg-neutral-light/30 text-neutral-mid",
} as const;

export function PreviredEstadoConexion() {
  const cred = usePreviredCredential();
  const consent = useSourceConsent(PREVIRED_SOURCE_CODE);

  const { tono, titulo, detalle } = estadoConexionPrevired({
    cargando: cred.isLoading || consent.isLoading,
    error: cred.isError || consent.isError,
    claveActiva: cred.data?.is_active ?? false,
    permisoValido: consent.data?.is_valid ?? false,
  });

  const Icono = ICONO[tono];

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", TONO[tono])}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{titulo}</p>
        {detalle !== "" && <p className="text-xs opacity-90">{detalle}</p>}
      </div>
    </div>
  );
}
