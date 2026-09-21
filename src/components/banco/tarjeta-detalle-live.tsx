"use client";

import { CuentaDetalleLive } from "./cuenta-detalle-live";

export function TarjetaDetalleLive({
  op,
  mesActual,
  conciliarEnabled = false,
}: {
  op: string;
  mesActual: string;
  conciliarEnabled?: boolean;
}) {
  return (
    <CuentaDetalleLive
      numeroCuenta={op}
      mesActual={mesActual}
      conciliarEnabled={conciliarEnabled}
    />
  );
}
