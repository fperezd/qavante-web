"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useOperationalResult } from "@/lib/api/gestion";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";
import { MargenesWidget } from "./margenes-widget";
import { margenesMesAnterior } from "./margenes-model";

/* Contenedor del widget "Márgenes" del Inicio. Ancla al MES ANTERIOR cerrado (el en curso engaña, #796).
   Container: NO se testea por Storybook (ADR-0018); la lógica vive en `margenes-model` (unit).
   Siempre renderiza una tarjeta (no null): con los márgenes, o un estado honesto. */

export function MargenesLive() {
  const mesAnterior = React.useMemo(
    () => shiftPeriod(currentPeriodSantiago(new Date()), -1),
    [],
  );
  const query = useOperationalResult(mesAnterior);
  const data = React.useMemo(() => margenesMesAnterior(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data || !data.confiable) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Márgenes</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no podemos calcular tus márgenes de {mesCorto(mesAnterior)} con confianza.
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

  return <MargenesWidget data={data} />;
}
