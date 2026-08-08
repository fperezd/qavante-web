"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useBiceSaldo } from "@/lib/api/treasury";
import { SaldosBancoWidget } from "./saldos-banco-widget";
import { saldosBanco } from "./saldos-banco-model";

/* Contenedor del widget "Saldos en banco" del Inicio. Trae `/api/bice/saldo` (cookie-open; degrada solo
   si el banco no responde). Container: NO se testea por Storybook (ADR-0018); la lógica vive en
   `saldos-banco-model` (unit). Siempre renderiza una tarjeta (no null): con los saldos, o estado honesto. */

export function SaldosBancoLive() {
  const query = useBiceSaldo();
  const data = React.useMemo(() => saldosBanco(query.data), [query.data]);

  if (query.isLoading) {
    return <div className="h-44 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }

  if (!data) {
    return (
      <QavanteCard
        variant="bordered"
        className="h-full"
        header={<span className="font-medium">Saldos en banco</span>}
      >
        <p className="py-3 text-sm text-neutral-mid">
          No pudimos leer tus saldos del banco ahora. Conectá el banco o reintentá desde Banco.
        </p>
        <Link
          href="/banco"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ver banco
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </QavanteCard>
    );
  }

  return <SaldosBancoWidget data={data} />;
}
