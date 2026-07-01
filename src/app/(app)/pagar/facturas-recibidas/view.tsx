"use client";

import * as React from "react";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { defaultPeriod, normalizePeriod } from "@/components/sii/sii-period-form-schema";
import { useSiiRcvCompras } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook RCV compras
   y delega el render al view presentacional reusable.

   Auto-carga: el período arranca en el default (mes anterior) para que
   las compras aparezcan al entrar sin apretar "Consultar". El form deja
   cambiar el mes cuando el user quiera. */
export function FacturasRecibidasView() {
  const [period, setPeriod] = React.useState<string | null>(() =>
    normalizePeriod(defaultPeriod()),
  );
  const query = useSiiRcvCompras({ periodo: period ?? "" });
  return <RcvListView kind="compras" period={period} onPeriodChange={setPeriod} query={query} />;
}
