"use client";

import * as React from "react";
import { BheListView } from "@/components/sii/bhe-list-view";
import { defaultPeriod, normalizePeriod } from "@/components/sii/sii-period-form-schema";
import { useSiiBhe } from "@/lib/api/sii";

/* Wrapper client del page Server Component — invoca el hook BHE y
   delega el render al view presentacional reusable.

   Auto-carga: el período arranca en el default (mes anterior) para que
   las boletas de honorarios aparezcan al entrar sin apretar "Consultar".
   El form deja cambiar el mes cuando el user quiera. */
export function HonorariosRecibidosView() {
  const [period, setPeriod] = React.useState<string | null>(() =>
    normalizePeriod(defaultPeriod()),
  );
  const query = useSiiBhe({ periodo: period ?? "" });
  return <BheListView period={period} onPeriodChange={setPeriod} query={query} />;
}
