"use client";

import * as React from "react";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { useSiiRcvCompras } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook RCV compras
   y delega el render al view presentacional reusable. */
export function FacturasRecibidasView() {
  const [period, setPeriod] = React.useState<string | null>(null);
  const query = useSiiRcvCompras({ periodo: period ?? "" });
  return <RcvListView kind="compras" period={period} onPeriodChange={setPeriod} query={query} />;
}
