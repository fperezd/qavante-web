"use client";

import * as React from "react";
import { AlertCircle, CalendarRange, CheckCircle2, Landmark, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSyncSiiRcv } from "@/lib/api/sii";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";
import { expandPeriodRange } from "@/lib/period/period-range";
import { SourceLastSync } from "./source-last-sync";

/* Sincronizar el AÑO del SII (RCV compras/ventas). El sync del día a día (SII + banco)
   vive en "Actualizar todo" del header — acá queda SOLO el backfill del año completo
   (pedido de Fernando 2026-07-20: la sincronización recurrente arriba, en Credenciales
   solo lo del año). El endpoint es por período (mes): enero → mes en curso, uno por uno
   (secuencial, para no golpear al SII), tolerante a meses sin datos. Para la primera carga
   o si faltan meses hacia atrás — llena los maestros / Cobrar / Pagar. El año es SIEMPRE el
   año calendario en curso (America/Santiago), nunca hardcodeado. Requiere consentimiento
   `sii_rcv`; si falta, el error lo explica. */

type SyncRun = {
  done: number;
  total: number;
  failed: number;
  running: boolean;
  lastError?: unknown;
};

export function SiiSyncCard() {
  const sync = useSyncSiiRcv();
  const currentPeriod = currentPeriodSantiago(new Date()); // "YYYY-MM" del mes en curso
  const year = currentPeriod.slice(0, 4); // año calendario en curso
  const [run, setRun] = React.useState<SyncRun | null>(null);

  async function runSync(months: string[]) {
    setRun({ done: 0, total: months.length, failed: 0, running: true });
    let failed = 0;
    let lastError: unknown;
    for (let i = 0; i < months.length; i++) {
      try {
        await sync.mutateAsync(months[i]!);
      } catch (e) {
        failed++; // un mes sin datos / error puntual no aborta el resto
        lastError = e;
      }
      setRun({
        done: i + 1,
        total: months.length,
        failed,
        running: i + 1 < months.length,
        lastError,
      });
    }
  }

  const succeeded = run ? run.done - run.failed : 0;
  const allFailed = Boolean(run && !run.running && run.total > 0 && succeeded === 0);

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Sincronizar el año (SII)</span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid">
          Trae el <strong>año completo</strong> de compras y ventas del SII ({year}, enero → hoy).
          Úsalo para la primera carga o si te faltan meses hacia atrás — es lo que llena tus maestros
          de Clientes, Proveedores y Honorarios. El día a día se actualiza con{" "}
          <strong>Actualizar todo</strong> (arriba a la derecha).
        </p>

        <SourceLastSync sourceCode="sii_rcv" />

        {/* Progreso / resultado del backfill del año. */}
        {run && run.running && (
          <div className="flex items-start gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary-50 p-2.5 text-sm text-brand-primary-700">
            <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" aria-hidden="true" />
            <p aria-live="polite">
              Sincronizando: {run.done}/{run.total} {run.total === 1 ? "mes" : "meses"}…
            </p>
          </div>
        )}
        {run && !run.running && !allFailed && (
          <div className="flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-50 p-2.5 text-sm text-success-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              Listo: {succeeded} de {run.total} {run.total === 1 ? "mes" : "meses"} sincronizados
              {run.failed > 0 && ` (${run.failed} sin datos o con error)`}. Tus documentos
              aparecerán en Cobrar/Pagar en unos minutos.
            </p>
          </div>
        )}
        {allFailed && (
          <div
            className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-50 p-2.5 text-sm text-danger-700"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {run?.lastError instanceof ApiError
                ? apiErrorToUserMessage(run.lastError)
                : "No pudimos sincronizar el SII. Intenta de nuevo en unos segundos."}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <QavanteButton
            size="sm"
            loading={Boolean(run?.running)}
            disabled={Boolean(run?.running)}
            onClick={() => runSync(expandPeriodRange({ desde: `${year}-01`, hasta: currentPeriod }))}
          >
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            Sincronizar todo {year}
          </QavanteButton>
        </div>
      </div>
    </QavanteCard>
  );
}
