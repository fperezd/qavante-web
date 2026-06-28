"use client";

import { AlertCircle, CheckCircle2, Landmark, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSyncSiiRcv } from "@/lib/api/sii";
import {
  defaultPeriod,
  normalizePeriod,
  formatPeriodLabel,
} from "@/components/sii/sii-period-form-schema";
import { SourceLastSync } from "./source-last-sync";

/* Sincronizar SII (RCV compras/ventas). Igual que el sync del banco: dispara la
   traída desde el SII. El endpoint es por período → sincronizamos el mes anterior
   (el más reciente con datos completos). Requiere consentimiento `sii_rcv`
   aceptado; si falta, el error lo explica. */

export function SiiSyncCard() {
  const sync = useSyncSiiRcv();
  const periodoMmAaaa = defaultPeriod(); // MM-AAAA (mes anterior)
  const periodoApi = normalizePeriod(periodoMmAaaa); // YYYY-MM para el backend

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Sincronizar SII</span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid">
          Trae tus compras y ventas del SII. Si no estás seguro de que se sincronizó, hazlo manual.
          Sincroniza el período <strong>{formatPeriodLabel(periodoApi)}</strong> (el último mes
          completo).
        </p>

        <SourceLastSync sourceCode="sii_rcv" />

        {sync.isSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-500/10 p-2.5 text-sm text-success-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              Sincronización iniciada. Tus documentos aparecerán en Cobrar/Pagar en unos minutos.
            </p>
          </div>
        )}
        {sync.isError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 p-2.5 text-sm text-danger-500"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {sync.error instanceof ApiError
                ? apiErrorToUserMessage(sync.error)
                : "No pudimos sincronizar el SII. Intenta de nuevo en unos segundos."}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <QavanteButton size="sm" loading={sync.isPending} onClick={() => sync.mutate(periodoApi)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sincronizar SII
          </QavanteButton>
        </div>
      </div>
    </QavanteCard>
  );
}
