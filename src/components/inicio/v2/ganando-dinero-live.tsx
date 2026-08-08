"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useOperationalResult } from "@/lib/api/gestion";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";
import { GanandoDineroWidget } from "./ganando-dinero-widget";
import { resultadoMesAnterior } from "./ganando-dinero-model";

/* Contenedor del widget "¿Estás ganando dinero?" (Inicio v2). Ancla al MES ANTERIOR cerrado
   (`shiftPeriod(-1)` del actual), NO el mes en curso. Container: NO se testea por Storybook (ADR-0018);
   la lógica vive en `ganando-dinero-model` (unit). Siempre renderiza una tarjeta (no null, así no queda
   un hueco en la grilla): con el resultado, o un estado honesto si aún no se puede afirmar. */

export function GanandoDineroLive() {
  const mesAnterior = React.useMemo(() => shiftPeriod(currentPeriodSantiago(new Date()), -1), []);
  const query = useOperationalResult(mesAnterior);

  const data = React.useMemo(() => resultadoMesAnterior(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  // Sin dato o resultado implausible → estado honesto (no afirmamos un resultado dudoso), pero la tarjeta
  // igual existe (el dueño la eligió en su catálogo).
  if (!data || !data.confiable) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">¿Estás ganando dinero?</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no podemos afirmar tu resultado de {mesCorto(mesAnterior)} con confianza.
        </p>
        <Link
          href="/gestion"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver Gestión
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <GanandoDineroWidget data={data} />;
}
