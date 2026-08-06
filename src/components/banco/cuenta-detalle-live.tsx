"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useBiceSaldo, useBiceAccounts, useBankMovements, treasuryKeys } from "@/lib/api/treasury";
import {
  useReconciliationReview,
  useConfirmReconciliation,
  useRejectReconciliation,
} from "@/lib/api/reconciliation";
import { interpretarErrorConciliar } from "@/components/caja/conciliacion/reconciliacion-cola-map";
import { MovimientosDetalle, type AccionConciliar } from "./movimientos-detalle";
import {
  bankAccountIdDeCuenta,
  movimientosDeCuenta,
  mapaSugerencias,
} from "./banco-movimientos-model";

/* Detalle de una CUENTA CORRIENTE: sus movimientos por mes. Fuente = `/api/bank-movements` (stored,
   rápido, filtrable por mes), NO la cartola live. El `numeroCuenta` (token de la URL) se resuelve
   contra el `saldo` de bice (para nombre/número/moneda) y `bice/accounts` (para el `bank_account_id`
   con el que se filtran los movimientos). `mesActual` lo calcula el server (Santiago).

   Fase 2 (`conciliarEnabled`, flag `bancoConciliacion`): trae la cola de conciliación (`review`) y
   ofrece el match propuesto de cada movimiento por conciliar + confirmar / rechazar. La cola es
   global; la cruzamos por `movement_id` con los movimientos de ESTA cuenta. */

export function CuentaDetalleLive({
  numeroCuenta,
  mesActual,
  conciliarEnabled = false,
}: {
  numeroCuenta: string;
  mesActual: string;
  conciliarEnabled?: boolean;
}) {
  const [period, setPeriod] = React.useState(mesActual);
  const qc = useQueryClient();

  const saldoQuery = useBiceSaldo();
  const cuenta = saldoQuery.data?.cuentas?.find((c) => c.numeroCuenta === numeroCuenta);
  const accountsQuery = useBiceAccounts();
  const bankAccountId = bankAccountIdDeCuenta(
    accountsQuery.data?.accounts,
    cuenta?.numeroFormateado,
  );
  const bankQuery = useBankMovements({ period });

  const moneda = cuenta?.moneda ?? "CLP";
  const movimientos = React.useMemo(
    () => movimientosDeCuenta(bankQuery.data?.items ?? [], bankAccountId, moneda),
    [bankQuery.data, bankAccountId, moneda],
  );

  // Fase 2: cola de conciliación (solo si el flag está ON). Cruzamos por movement_id.
  const reviewQuery = useReconciliationReview(conciliarEnabled);
  const confirmar = useConfirmReconciliation();
  const rechazar = useRejectReconciliation();
  const sugerencias = React.useMemo(
    () => mapaSugerencias(reviewQuery.data?.items),
    [reviewQuery.data],
  );
  const [accionEnCurso, setAccionEnCurso] = React.useState<AccionConciliar | null>(null);

  const refrescarMovimientos = React.useCallback(() => {
    // Tras conciliar/rechazar, el estado del movimiento cambió → refrescar movimientos + cola.
    qc.invalidateQueries({ queryKey: treasuryKeys.all });
    reviewQuery.refetch();
  }, [qc, reviewQuery]);

  const manejarError = React.useCallback(
    (err: unknown) => {
      const { yaNoEnRevision, mensaje } = interpretarErrorConciliar(err);
      if (yaNoEnRevision) {
        toast.warning(mensaje);
        reviewQuery.refetch(); // la cola quedó vieja → traé la real
      } else {
        toast.error(mensaje);
      }
    },
    [reviewQuery],
  );

  const onConciliar = React.useCallback(
    (movId: string) => {
      setAccionEnCurso({ movId, tipo: "conciliar" });
      confirmar.mutate(movId, {
        onSuccess: () => {
          toast.success("Conciliado.");
          refrescarMovimientos();
        },
        onError: manejarError,
        onSettled: () => setAccionEnCurso(null),
      });
    },
    [confirmar, manejarError, refrescarMovimientos],
  );

  const onRechazar = React.useCallback(
    (movId: string) => {
      setAccionEnCurso({ movId, tipo: "rechazar" });
      rechazar.mutate(movId, {
        onSuccess: () => {
          toast.success("Descartado. El movimiento queda sin conciliar.");
          refrescarMovimientos();
        },
        onError: manejarError,
        onSettled: () => setAccionEnCurso(null),
      });
    },
    [rechazar, manejarError, refrescarMovimientos],
  );

  // Cargando mientras no sepamos aún el mapeo (saldo/accounts) o los movimientos del mes.
  const loading =
    bankQuery.isLoading ||
    (saldoQuery.isLoading && !cuenta) ||
    (accountsQuery.isLoading && !bankAccountId);
  const actualizando = bankQuery.isFetching || saldoQuery.isFetching || accountsQuery.isFetching;
  const horaTexto =
    bankQuery.dataUpdatedAt > 0
      ? new Date(bankQuery.dataUpdatedAt).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <MovimientosDetalle
      titulo={cuenta?.nombreCuenta ?? "Cuenta corriente"}
      subtitulo={cuenta?.numeroFormateado ? `${cuenta.numeroFormateado} · BICE` : "BICE"}
      mesActual={mesActual}
      period={period}
      onPeriodChange={setPeriod}
      movimientos={movimientos}
      conEstado
      loading={loading}
      actualizando={actualizando}
      error={bankQuery.error}
      horaTexto={horaTexto}
      conciliarEnabled={conciliarEnabled}
      sugerencias={sugerencias}
      onConciliar={onConciliar}
      onRechazar={onRechazar}
      accionEnCurso={accionEnCurso}
    />
  );
}
