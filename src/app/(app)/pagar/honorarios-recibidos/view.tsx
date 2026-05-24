"use client";

import * as React from "react";
import { BheListView } from "@/components/sii/bhe-list-view";
import { useSiiBhe } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook BHE y
   delega el render al view presentacional reusable. */
export function HonorariosRecibidosView() {
  const [period, setPeriod] = React.useState<string | null>(null);
  const query = useSiiBhe({ periodo: period ?? "" });
  return <BheListView period={period} onPeriodChange={setPeriod} query={query} />;
}
