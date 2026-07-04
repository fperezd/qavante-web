"use client";

import * as React from "react";
import { AlertCircle, CalendarRange, CheckCircle2, Landmark, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSyncSiiRcv } from "@/lib/api/sii";
import {
  defaultPeriod,
  normalizePeriod,
  formatPeriodLabel,
} from "@/components/sii/sii-period-form-schema";
import { expandPeriodRange } from "@/lib/period/period-range";
import { SourceLastSync } from "./source-last-sync";

/* Sincronizar SII (RCV compras/ventas). Igual que el sync del banco: dispara la
   traída desde el SII. El endpoint es por período → sincronizamos el mes anterior
   (el más reciente con datos completos). Requiere consentimiento `sii_rcv`
   aceptado; si falta, el error lo explica.

   Backfill del año: el sync es por mes, así que un tenant nuevo solo tiene el
   último mes. "Sincronizar todo {año}" recorre enero→último mes completo de a uno
   (secuencial, para no golpear al SII) y tolera meses sin datos. */

type Backfill = { done: number; total: number; failed: number; running: boolean };

export function SiiSyncCard() {
  const sync = useSyncSiiRcv();
  const periodoMmAaaa = defaultPeriod(); // MM-AAAA (mes anterior)
  const periodoApi = normalizePeriod(periodoMmAaaa); // YYYY-MM para el backend
  const year = periodoApi.slice(0, 4);
  const [backfill, setBackfill] = React.useState<Backfill | null>(null);

  async function syncYear() {
    // Meses del año hasta el último completo (ej. 2026-01 … 2026-06).
    const months = expandPeriodRange({ desde: `${year}-01`, hasta: periodoApi });
    setBackfill({ done: 0, total: months.length, failed: 0, running: true });
    let failed = 0;
    for (let i = 0; i < months.length; i++) {
      try {
        await sync.mutateAsync(months[i]!);
      } catch {
        failed++; // un mes sin datos / error puntual no aborta el backfill
      }
      setBackfill({ done: i + 1, total: months.length, failed, running: i + 1 < months.length });
    }
  }

  const busy = sync.isPending || Boolean(backfill?.running);

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
          Trae tus compras y ventas del SII. <strong>Sincronizar todo {year}</strong> trae todos los
          meses del año (enero al último completo) — útil la primera vez o si faltan meses. O
          sincroniza solo <strong>{formatPeriodLabel(periodoApi)}</strong>, el último mes completo.
        </p>

        <SourceLastSync sourceCode="sii_rcv" />

        {/* Progreso del backfill del año (tiene prioridad sobre el mensaje del
            sync de un mes). */}
        {backfill && (
          <div className="flex items-start gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary-50 p-2.5 text-sm text-brand-primary-700">
            {backfill.running ? (
              <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            )}
            <p aria-live="polite">
              {backfill.running ? (
                <>
                  Sincronizando {year}: {backfill.done}/{backfill.total} meses…
                </>
              ) : (
                <>
                  Listo: {backfill.done - backfill.failed} de {backfill.total} meses de {year}{" "}
                  sincronizados
                  {backfill.failed > 0 && ` (${backfill.failed} sin datos o con error)`}. Tus
                  documentos aparecerán en Cobrar/Pagar en unos minutos.
                </>
              )}
            </p>
          </div>
        )}

        {!backfill && sync.isSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-50 p-2.5 text-sm text-success-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              Sincronización iniciada. Tus documentos aparecerán en Cobrar/Pagar en unos minutos.
            </p>
          </div>
        )}
        {!backfill && sync.isError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-50 p-2.5 text-sm text-danger-700"
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

        <div className="flex flex-wrap justify-end gap-2">
          <QavanteButton
            size="sm"
            variant="secondary"
            loading={Boolean(backfill?.running)}
            disabled={busy}
            onClick={syncYear}
          >
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            Sincronizar todo {year}
          </QavanteButton>
          <QavanteButton
            size="sm"
            loading={sync.isPending && !backfill?.running}
            disabled={busy}
            onClick={() => {
              setBackfill(null);
              sync.mutate(periodoApi);
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Solo {formatPeriodLabel(periodoApi)}
          </QavanteButton>
        </div>
      </div>
    </QavanteCard>
  );
}
