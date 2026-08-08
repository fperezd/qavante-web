"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useBukPayroll } from "@/lib/api/buk";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { RemuneracionesWidget } from "./remuneraciones-widget";
import { remuneracionesMes } from "./remuneraciones-model";

/* Contenedor del widget "Remuneraciones" del Inicio. Trae los totales de planilla del último mes cerrado
   desde BUK. Container: NO se testea por Storybook (ADR-0018); la lógica vive en `remuneraciones-model`
   (unit). Siempre renderiza una tarjeta (no null): con los totales, o un estado honesto. */

export function RemuneracionesLive() {
  const periodo = React.useMemo(
    () => shiftPeriod(currentPeriodSantiago(new Date()), -1),
    [],
  );
  const query = useBukPayroll({ period: periodo });
  const data = React.useMemo(() => remuneracionesMes(query.data, periodo), [query.data, periodo]);

  if (query.isLoading) {
    return <div className="h-36 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Remuneraciones</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no tenemos tu planilla del período. Conectá BUK o revisá en Remuneraciones.
        </p>
        <Link
          href="/remuneraciones"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver remuneraciones
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <RemuneracionesWidget data={data} />;
}
