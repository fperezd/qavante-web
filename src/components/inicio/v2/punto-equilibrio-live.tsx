"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useOperationalResultBreakdown } from "@/lib/api/gestion";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { computePuntoEquilibrio } from "@/components/gestion/v2/punto-equilibrio-model";
import { PuntoEquilibrioWidget } from "./punto-equilibrio-widget";

/* Contenedor del widget "Punto de equilibrio" del Inicio. Trae el breakdown mensualizado (últimos meses
   con proforma) y reusa `computePuntoEquilibrio` (modelo ya testeado en Gestión) → el piso = lo que
   gastaste el último mes cerrado. Container: NO se testea por Storybook (ADR-0018). Siempre renderiza. */

export function PuntoEquilibrioLive() {
  const rango = React.useMemo(() => {
    const actual = currentPeriodSantiago(new Date());
    return { from: shiftPeriod(actual, -3), to: actual };
  }, []);

  const query = useOperationalResultBreakdown(rango.from, rango.to, { includeProforma: true });
  const data = React.useMemo(
    () => (query.data ? computePuntoEquilibrio(query.data) : null),
    [query.data],
  );

  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Punto de equilibrio</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Necesitamos al menos un mes cerrado con gastos para calcular tu punto de equilibrio.
        </p>
        <Link
          href="/gestion"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver gestión
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <PuntoEquilibrioWidget data={data} />;
}
