"use client";

import * as React from "react";
import { Landmark, Loader2 } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  useBiceSaldo,
  useBiceCuentasBalances,
  useBiceTarjetas,
  useBiceTarjetasSaldos,
} from "@/lib/api/treasury";
import { BancoBankCard } from "./banco-bank-card";
import { cuposDeTarjeta } from "./banco-model";

/* Pantalla Banco (gated `bancoScreen`): los PRODUCTOS del tenant agrupados POR BANCO — cuentas
   corrientes (saldo + línea de crédito) + tarjetas de crédito (cupo). Hoy BICE (la fuente `/api/bice/*`);
   estructurado para sumar otro banco después (otra sección `BancoBankCard`). Container: compone los 4
   hooks de bice; la lógica pura vive en `banco-model` + `bank-balances-linea-credito`. */

export function BancoView() {
  const saldoQuery = useBiceSaldo();
  const cuentas = React.useMemo(() => saldoQuery.data?.cuentas ?? [], [saldoQuery.data]);
  const { balancePorCuenta, isLoading: lcLoading } = useBiceCuentasBalances(
    cuentas.map((c) => c.numeroCuenta),
    cuentas.length > 0,
  );

  const tarjetasQuery = useBiceTarjetas();
  const tarjetas = React.useMemo(() => tarjetasQuery.data?.data ?? [], [tarjetasQuery.data]);
  const { saldoPorTarjeta } = useBiceTarjetasSaldos(
    tarjetas.map((t) => t.operationNumber),
    tarjetas.length > 0,
  );

  const cuentasLoading = saldoQuery.isLoading;
  const tarjetasLoading = tarjetasQuery.isLoading;

  // Solo error DURO (las dos fuentes cayeron): si una responde, mostramos lo que hay.
  if (saldoQuery.isError && tarjetasQuery.isError) {
    return <QavanteInlineError error={saldoQuery.error} what="tus productos de banco" />;
  }

  // Vacío REAL: solo cuando AMBAS terminaron de cargar y no hay nada (no mientras BICE responde).
  if (!cuentasLoading && !tarjetasLoading && cuentas.length === 0 && tarjetas.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="No hay bancos conectados"
        description="Cuando conectes un banco vas a ver acá sus cuentas y tarjetas de crédito, con saldos y cupos."
      />
    );
  }

  const referencia = cuentas.reduce<string | null>(
    (acc, c) => (c.fechaHasta && (!acc || c.fechaHasta > acc) ? c.fechaHasta : acc),
    null,
  );
  const cuentasProd = cuentas.map((cuenta) => ({
    cuenta,
    balance: balancePorCuenta.get(cuenta.numeroCuenta),
  }));
  const tarjetasProd = tarjetas.map((tarjeta) => ({
    tarjeta,
    cupos: cuposDeTarjeta(saldoPorTarjeta.get(tarjeta.operationNumber)),
  }));

  // Hoy un solo banco (BICE). Cuando haya más, se arma una sección por banco.
  return (
    <div className="space-y-4">
      {(cuentasLoading || tarjetasLoading) && (
        <p className="flex items-center gap-2 rounded-lg bg-info-500/[.06] px-3 py-2 text-xs text-neutral-mid">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-info-700" aria-hidden="true" />
          Consultando tus saldos y cupos en BICE en vivo — puede tardar unos segundos.
        </p>
      )}
      <BancoBankCard
        banco="BICE"
        referencia={referencia}
        cuentas={cuentasProd}
        tarjetas={tarjetasProd}
        cuentasLoading={cuentasLoading}
        tarjetasLoading={tarjetasLoading}
        lcLoading={lcLoading}
      />
    </div>
  );
}
