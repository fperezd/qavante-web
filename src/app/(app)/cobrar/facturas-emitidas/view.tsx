"use client";

import * as React from "react";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { defaultPeriod, normalizePeriod } from "@/components/sii/sii-period-form-schema";
import { useSiiRcvVentas } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook RCV ventas
   y delega el render al view presentacional reusable.

   Auto-carga: el período arranca en el default (mes anterior, el último
   con datos completos en el SII) para que las ventas aparezcan al entrar
   sin apretar "Consultar". El form deja cambiar el mes cuando el user
   quiera. */
export function FacturasEmitidasView() {
  const [period, setPeriod] = React.useState<string | null>(() =>
    normalizePeriod(defaultPeriod()),
  );
  const query = useSiiRcvVentas({ periodo: period ?? "" });
  return <RcvListView kind="ventas" period={period} onPeriodChange={setPeriod} query={query} />;
}
