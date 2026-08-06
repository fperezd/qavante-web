"use client";

import * as React from "react";
import { useBiceSaldo, useBiceAccounts, useBankMovements } from "@/lib/api/treasury";
import { MovimientosDetalle } from "./movimientos-detalle";
import { bankAccountIdDeCuenta, movimientosDeCuenta } from "./banco-movimientos-model";

/* Detalle de una CUENTA CORRIENTE: sus movimientos por mes. Fuente = `/api/bank-movements` (stored,
   rápido, filtrable por mes), NO la cartola live. El `numeroCuenta` (token de la URL) se resuelve
   contra el `saldo` de bice (para nombre/número/moneda) y `bice/accounts` (para el `bank_account_id`
   con el que se filtran los movimientos). `mesActual` lo calcula el server (Santiago). */

export function CuentaDetalleLive({
  numeroCuenta,
  mesActual,
}: {
  numeroCuenta: string;
  mesActual: string;
}) {
  const [period, setPeriod] = React.useState(mesActual);

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
    />
  );
}
