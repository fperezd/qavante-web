"use client";

import * as React from "react";
import { Landmark, RefreshCw } from "lucide-react";
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

  // Sesión de BICE vencida: el endpoint responde 200 pero con cuerpo de error (`status:"error"`,
  // `code:"session_expired"`). El banco SÍ está conectado; NO decir "no hay bancos" (miente). Mostramos
  // la verdad: la sesión se venció y hay que reconectar. (La reconexión self-serve la debe exponer el
  // backend — hoy `BICE_LOGIN_STRATEGY=local_only`; escalado a CC-API.)
  const statusOf = (d: unknown) => (d as { status?: string } | undefined)?.status;
  const sesionBiceVencida =
    statusOf(saldoQuery.data) === "error" || statusOf(tarjetasQuery.data) === "error";

  if (
    !cuentasLoading &&
    !tarjetasLoading &&
    cuentas.length === 0 &&
    tarjetas.length === 0 &&
    sesionBiceVencida
  ) {
    return (
      <QavanteEmpty
        icon={RefreshCw}
        title="Tu sesión con el banco se venció"
        description="Tu banco sigue conectado, pero la sesión con BICE expiró y no pudimos traer tus saldos y tarjetas. Hay que reconectar el banco para volver a verlos actualizados."
      />
    );
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

  // Frescura estilo "actualizando" (pedido de Fernando): mostramos LO ÚLTIMO que había + la hora del
  // último dato + un spinner mientras refresca — nunca un cuadro en blanco con "consultando en vivo".
  // `isFetching` cubre el refetch en background (react-query conserva los datos previos mientras tanto);
  // `dataUpdatedAt` es la hora real del último fetch OK. (El primer load frío depende del cache-first
  // del backend — escalado; con datos en cache, la revisita muestra lo anterior al instante.)
  const actualizando = saldoQuery.isFetching || tarjetasQuery.isFetching;
  const actualizadoAt = Math.max(saldoQuery.dataUpdatedAt, tarjetasQuery.dataUpdatedAt);
  const horaTexto =
    actualizadoAt > 0
      ? new Date(actualizadoAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
      : null;

  // Hoy un solo banco (BICE). Cuando haya más, se arma una sección por banco.
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-neutral-mid" aria-live="polite">
        {actualizando ? (
          <span className="inline-flex items-center gap-1.5 text-info-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Actualizando saldos…
          </span>
        ) : horaTexto ? (
          <span>Actualizado a las {horaTexto}</span>
        ) : null}
      </div>
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
