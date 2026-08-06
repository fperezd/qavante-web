"use client";

import * as React from "react";
import { useBiceTarjetas, useBiceTarjetaMovimientos } from "@/lib/api/treasury";
import { MovimientosDetalle } from "./movimientos-detalle";
import { movimientosDeTarjeta } from "./banco-movimientos-model";

/* Detalle de una TARJETA DE CRÉDITO: sus movimientos por mes. Fuente = `/api/bice/tarjetas/{op}/
   movimientos` (devuelve una ventana; filtramos por mes en el FE). `op` viene de la URL; el nombre/
   titular sale del listado de tarjetas (cacheado). `mesActual` lo calcula el server (Santiago). */

export function TarjetaDetalleLive({ op, mesActual }: { op: string; mesActual: string }) {
  const [period, setPeriod] = React.useState(mesActual);

  const tarjetasQuery = useBiceTarjetas();
  const tarjeta = tarjetasQuery.data?.data?.find((t) => t.operationNumber === op);
  const movQuery = useBiceTarjetaMovimientos(op);

  const movimientos = React.useMemo(
    () => movimientosDeTarjeta(movQuery.data?.data, period),
    [movQuery.data, period],
  );

  const actualizando = movQuery.isFetching || tarjetasQuery.isFetching;
  const horaTexto =
    movQuery.dataUpdatedAt > 0
      ? new Date(movQuery.dataUpdatedAt).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const titulo = tarjeta?.product
    ? `${tarjeta.product} ····${op.slice(-4)}`
    : "Tarjeta de crédito";

  return (
    <MovimientosDetalle
      titulo={titulo}
      subtitulo={tarjeta?.holder ? `${tarjeta.holder} · BICE` : "BICE"}
      mesActual={mesActual}
      period={period}
      onPeriodChange={setPeriod}
      movimientos={movimientos}
      loading={movQuery.isLoading}
      actualizando={actualizando}
      error={movQuery.error}
      horaTexto={horaTexto}
    />
  );
}
