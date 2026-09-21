"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useBankAccounts } from "@/lib/api/treasury";
import { SaldosBancoWidget } from "./saldos-banco-widget";
import { saldosBancoDesdeCuentas } from "./saldos-banco-model";

export function SaldosBancoLive() {
  const query = useBankAccounts();
  const data = React.useMemo(() => saldosBancoDesdeCuentas(query.data?.items), [query.data]);

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
          No pudimos leer tus saldos del banco ahora. Conecta el banco o vuelve a intentar desde
          Banco.
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
