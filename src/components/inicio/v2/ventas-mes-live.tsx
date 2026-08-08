"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useSiiRcvComparativos } from "@/lib/api/sii";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { VentasMesWidget } from "./ventas-mes-widget";
import { ventasPorMes } from "./ventas-mes-model";

/* Contenedor del widget "Ventas por mes" del Inicio. Trae la serie de los últimos 6 meses CERRADOS de
   los comparativos del Libro de ventas. Container: NO se testea por Storybook (ADR-0018); la lógica vive
   en `ventas-mes-model` (unit). Siempre renderiza una tarjeta (no null): con la serie, o estado honesto. */

export function VentasMesLive() {
  const rango = React.useMemo(() => {
    const actual = currentPeriodSantiago(new Date());
    return { desde: shiftPeriod(actual, -6), hasta: shiftPeriod(actual, -1) };
  }, []);

  const query = useSiiRcvComparativos("ventas", rango.desde, rango.hasta);
  const data = React.useMemo(() => ventasPorMes(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Ventas por mes</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no tenemos suficientes meses de ventas para mostrar la tendencia.
        </p>
        <Link
          href="/gestion/ventas"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver ventas
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <VentasMesWidget data={data} />;
}
