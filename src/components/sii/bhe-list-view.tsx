"use client";

import * as React from "react";
import { Briefcase, Inbox } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import type { BheRecibida, BheResponse } from "@/lib/api/sii";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { SiiPeriodForm } from "./sii-period-form";
import { formatPeriodLabel } from "./sii-period-form-schema";

/* Vista BHE recibidas (Boletas de Honorarios Electrónicas que me cobran
   profesionales) — Sprint C1 PR-Sii3. Shape distinto a RCV: tiene
   `monto_bruto`, `retencion` y `monto_liquido` (no IVA / total). Por eso
   componente separado, no parametrizado.

   Sigue el mismo patrón presentacional que RcvListView: recibe la query
   por prop, el page invoca `useSiiBhe({periodo})`. */

export interface BheListViewProps {
  /** Período actualmente consultado (null = todavía no se consultó nada). */
  period: string | null;
  /** Callback cuando el user submitea un nuevo período (validado). */
  onPeriodChange: (periodo: string) => void;
  /** Query de TanStack invocada por el page (useSiiBhe). */
  query: UseQueryResult<BheResponse, unknown>;
}

/* Las boletas anuladas NO cuentan para el líquido ni la retención (la retención
   se revierte al anular). Se listan tachadas pero no suman. */
function sumLiquido(items: BheRecibida[]): number {
  return items.reduce(
    (acc, b) => acc + (!b.anulada && typeof b.monto_liquido === "number" ? b.monto_liquido : 0),
    0,
  );
}

function sumRetencion(items: BheRecibida[]): number {
  return items.reduce(
    (acc, b) => acc + (!b.anulada && typeof b.retencion === "number" ? b.retencion : 0),
    0,
  );
}

export function BheListView({ period, onPeriodChange, query }: BheListViewProps) {
  const items: BheRecibida[] = query.data?.bhe ?? [];
  const liquidoTotal = sumLiquido(items);
  const retencionTotal = sumRetencion(items);
  const anuladasCount = items.filter((b) => b.anulada).length;

  return (
    <div className="space-y-4">
      <SiiPeriodForm
        onSubmit={onPeriodChange}
        loading={query.isFetching}
        hint="La retención del 13.75% (2026) corre por tu cuenta y se paga en el F29."
      />

      {!period && (
        <QavanteEmpty
          icon={Briefcase}
          title="Consulta tus honorarios recibidos"
          description="Elige un período y vas a ver las Boletas de Honorarios Electrónicas (BHE) que te emitieron profesionales. Incluye monto bruto, retención y monto líquido."
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando BHE al SII"
        />
      )}

      {period && query.isError && (
        <QavanteInlineError error={query.error} what="las boletas de honorarios" />
      )}

      {period && query.data && items.length === 0 && (
        <QavanteEmpty
          icon={Inbox}
          title="Sin BHE en el período"
          description="No hay boletas de honorarios emitidas a tu favor en este período. Prueba con otro período."
        />
      )}

      {period && items.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{formatPeriodLabel(period)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <QavanteBadge variant="info">
                  {items.length} {items.length === 1 ? "boleta" : "boletas"}
                </QavanteBadge>
                <span className="text-sm tabular-nums text-neutral-dark">
                  Líquido pagado: <span className="font-semibold">{formatClp(liquidoTotal)}</span>
                </span>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Fecha
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Emisor
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Folio
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Bruto
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Retención
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Líquido
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((b, i) => (
                  <tr
                    key={`${b.folio ?? "x"}-${b.rut_emisor ?? i}`}
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted",
                      b.anulada && "text-neutral-mid",
                    )}
                  >
                    <td className="py-2 pr-3 text-neutral-dark">
                      {formatDateLike(b.fecha_emision)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={cn("block text-neutral-dark", b.anulada && "text-neutral-mid line-through")}>
                        {b.nombre_emisor ?? "Sin nombre"}
                      </span>
                      {b.rut_emisor && (
                        <span className="block font-mono text-xs text-neutral-mid">
                          {b.rut_emisor}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn(b.anulada && "line-through")}>{b.folio ?? "—"}</span>
                        {b.anulada && <QavanteBadge variant="danger">Anulada</QavanteBadge>}
                      </span>
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums text-neutral-dark", b.anulada && "line-through")}>
                      {typeof b.monto_bruto === "number" ? formatClp(b.monto_bruto) : "—"}
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums text-neutral-mid", b.anulada && "line-through")}>
                      {typeof b.retencion === "number" ? formatClp(b.retencion) : "—"}
                    </td>
                    <td className={cn("py-2 text-right tabular-nums font-medium text-neutral-dark", b.anulada && "font-normal line-through")}>
                      {typeof b.monto_liquido === "number" ? formatClp(b.monto_liquido) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-mid">
            Retención acumulada del período: {formatClp(retencionTotal)}.
            {anuladasCount > 0 && (
              <>
                {" "}
                {anuladasCount} {anuladasCount === 1 ? "boleta anulada" : "boletas anuladas"} no
                {anuladasCount === 1 ? " suma" : " suman"} al líquido ni a la retención.
              </>
            )}{" "}
            Datos descargados del SII en vivo — las sumas son referenciales y se calculan sobre las
            boletas vigentes mostradas.
          </p>
        </QavanteCard>
      )}
    </div>
  );
}
