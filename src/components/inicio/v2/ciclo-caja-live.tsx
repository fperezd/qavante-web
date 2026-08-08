"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useCashCycle } from "@/lib/api/treasury";
import { CicloCajaWidget } from "./ciclo-caja-widget";
import { mapCicloCaja } from "./ciclo-caja-model";

/* Contenedor del widget "Ciclo de caja" del Inicio. Trae DSO/DPO/CCC del cash-cycle. Container: NO se
   testea por Storybook (ADR-0018); la lógica vive en `ciclo-caja-model` (unit). Siempre renderiza una
   tarjeta (no null, así no queda un hueco en la grilla): con el ciclo, o un estado honesto. */

export function CicloCajaLive() {
  const query = useCashCycle();
  const data = React.useMemo(() => mapCicloCaja(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Ciclo de caja</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Todavía no tenemos cobros y pagos con fecha suficientes para calcular tu ciclo de caja.
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

  return <CicloCajaWidget data={data} />;
}
