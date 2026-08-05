"use client";

import * as React from "react";
import { Landmark } from "lucide-react";
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
  const { balancePorCuenta } = useBiceCuentasBalances(
    cuentas.map((c) => c.numeroCuenta),
    cuentas.length > 0,
  );

  const tarjetasQuery = useBiceTarjetas();
  const tarjetas = React.useMemo(() => tarjetasQuery.data?.data ?? [], [tarjetasQuery.data]);
  const { saldoPorTarjeta } = useBiceTarjetasSaldos(
    tarjetas.map((t) => t.operationNumber),
    tarjetas.length > 0,
  );

  if (saldoQuery.isLoading || tarjetasQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-neutral-light/30" aria-busy="true" />;
  }
  // Solo error DURO (las dos fuentes cayeron): si una responde, mostramos lo que hay.
  if (saldoQuery.isError && tarjetasQuery.isError) {
    return <QavanteInlineError error={saldoQuery.error} what="tus productos de banco" />;
  }

  if (cuentas.length === 0 && tarjetas.length === 0) {
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
    <div className="space-y-6">
      <BancoBankCard
        banco="BICE"
        referencia={referencia}
        cuentas={cuentasProd}
        tarjetas={tarjetasProd}
      />
    </div>
  );
}
