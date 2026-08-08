"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useCashFlowReport } from "@/lib/api/treasury-reports";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { FlujoCajaWidget } from "./flujo-caja-widget";
import { flujoCajaReal } from "./flujo-caja-model";

/* Contenedor del widget "Flujo de caja" (real) del Inicio. Trae los ÚLTIMOS 3 MESES CERRADOS del
   cash-flow report (financial_layer=committed = lo clasificado) y deriva entró/salió/neto. Container: NO
   se testea por Storybook (ADR-0018); la lógica vive en `flujo-caja-model` (unit). Siempre renderiza una
   tarjeta (no null, así no queda un hueco en la grilla): con el flujo, o un estado honesto. */

export function FlujoCajaLive() {
  const rango = React.useMemo(() => {
    const actual = currentPeriodSantiago(new Date());
    return {
      enCurso: actual,
      period_from: shiftPeriod(actual, -3),
      period_to: shiftPeriod(actual, -1),
    };
  }, []);

  const query = useCashFlowReport({
    period_from: rango.period_from,
    period_to: rango.period_to,
    granularity: "month",
    financial_layer: "committed",
    group_by: "none",
  });

  const data = React.useMemo(
    () => flujoCajaReal(query.data, rango.enCurso),
    [query.data, rango.enCurso],
  );

  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  // Sin meses cerrados con datos → estado honesto, pero la tarjeta existe (el dueño la eligió).
  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Flujo de caja</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no tenemos meses cerrados con movimientos clasificados para mostrar tu flujo.
        </p>
        <Link
          href="/caja"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver caja
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <FlujoCajaWidget data={data} />;
}
