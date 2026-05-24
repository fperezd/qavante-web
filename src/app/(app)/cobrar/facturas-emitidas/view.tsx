"use client";

import * as React from "react";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { useSiiRcvVentas } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook RCV ventas
   y delega el render al view presentacional reusable. */
export function FacturasEmitidasView() {
  const [period, setPeriod] = React.useState<string | null>(null);
  const query = useSiiRcvVentas({ periodo: period ?? "" });
  return <RcvListView kind="ventas" period={period} onPeriodChange={setPeriod} query={query} />;
}
