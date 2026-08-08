"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useCollectionProjection } from "@/lib/api/treasury";
import { ComportamientoPagoWidget } from "./comportamiento-pago-widget";
import { comportamientoPago } from "./comportamiento-pago-model";

/* Contenedor del widget "Comportamiento de pago" del Inicio. Trae la proyección de cobros (vs_nominal).
   Container: NO se testea por Storybook (ADR-0018); la lógica vive en `comportamiento-pago-model` (unit).
   Siempre renderiza una tarjeta (no null): con el dato, o un estado honesto. */

export function ComportamientoPagoLive() {
  const query = useCollectionProjection();
  const data = React.useMemo(() => comportamientoPago(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-36 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Comportamiento de pago</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          Cuando tengas historial de cobros, acá te decimos cuándo te pagan de verdad tus clientes.
        </p>
        <Link
          href="/cobrar"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver cobranza
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <ComportamientoPagoWidget data={data} />;
}
