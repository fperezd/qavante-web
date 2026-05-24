"use client";

import * as React from "react";
import { Database, Inbox } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import type { RcvComprasResponse, RcvVentasResponse } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { SiiPeriodForm } from "./sii-period-form";
import { formatPeriodLabel } from "./sii-period-form-schema";

/* Vista reusable para RCV Compras / RCV Ventas (Sprint C1 PR-Sii3). RCV
   Compras y Ventas comparten **exactamente** el mismo shape (mismo subset
   slim del SII: tipo_doc, folio, fecha, rut_contraparte, razon_social,
   monto_neto, monto_iva, monto_total). Por eso un único componente
   parametrizado por `kind`.

   Diseño: el view es presentacional. Recibe la query resultante por prop
   (no invoca hook internamente) — eso permite que cada page elija el
   hook específico (`useSiiRcvCompras` o `useSiiRcvVentas`) sin invocar
   ambos de forma desperdiciada (la regla de hooks de React prohíbe
   invocación condicional).

   El backend ya devuelve `count` y el FE agrega la suma de monto_total
   como feedback visual. §17.4: NO es cálculo financiero, es agregado
   visual de presentación. Copy del card lo aclara. */

interface RcvDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
  [key: string]: unknown;
}

export type RcvKind = "compras" | "ventas";

export interface RcvListViewProps {
  /** `compras` o `ventas`. Determina copys y headers de la tabla. */
  kind: RcvKind;
  /** Período actualmente consultado (null = todavía no se consultó nada). */
  period: string | null;
  /** Callback cuando el user submitea un nuevo período (validado). */
  onPeriodChange: (periodo: string) => void;
  /** Query de TanStack — el page la invoca con el hook que corresponde
   *  (`useSiiRcvCompras` o `useSiiRcvVentas`) según el `kind`. */
  query: UseQueryResult<RcvComprasResponse | RcvVentasResponse, unknown>;
}

const COPY: Record<
  RcvKind,
  {
    emptyTitle: string;
    emptyDescription: string;
    initialTitle: string;
    initialDescription: string;
    partyLabel: string;
    hint: string;
    errorWhat: string;
  }
> = {
  compras: {
    emptyTitle: "Sin compras en el período",
    emptyDescription:
      "No hay documentos de compra registrados para este período en el SII. Probá con otro período o verificá con tu contador.",
    initialTitle: "Consultá tus compras del SII",
    initialDescription:
      "Elegí un período y vas a ver las facturas, notas y otros documentos de compra que el SII tiene registrados.",
    partyLabel: "Proveedor",
    hint: "Los datos del mes vigente típicamente no están completos hasta mediados del mes siguiente.",
    errorWhat: "las compras del SII",
  },
  ventas: {
    emptyTitle: "Sin ventas en el período",
    emptyDescription:
      "No hay documentos de venta registrados para este período en el SII. Probá con otro período o verificá con tu contador.",
    initialTitle: "Consultá tus ventas del SII",
    initialDescription:
      "Elegí un período y vas a ver las facturas, notas y otros documentos de venta que el SII tiene registrados.",
    partyLabel: "Cliente",
    hint: "Los datos del mes vigente típicamente no están completos hasta mediados del mes siguiente.",
    errorWhat: "las ventas del SII",
  },
};

function extractDocs(
  data: RcvComprasResponse | RcvVentasResponse | undefined,
  kind: RcvKind,
): RcvDoc[] {
  if (!data) return [];
  const arr =
    kind === "compras" ? (data as RcvComprasResponse).compras : (data as RcvVentasResponse).ventas;
  return (arr as RcvDoc[] | undefined) ?? [];
}

function sumTotal(docs: RcvDoc[]): number {
  return docs.reduce((acc, d) => acc + (typeof d.monto_total === "number" ? d.monto_total : 0), 0);
}

export function RcvListView({ kind, period, onPeriodChange, query }: RcvListViewProps) {
  const copy = COPY[kind];
  const docs = extractDocs(query.data, kind);
  const total = sumTotal(docs);

  return (
    <div className="space-y-4">
      <SiiPeriodForm onSubmit={onPeriodChange} loading={query.isFetching} hint={copy.hint} />

      {!period && (
        <QavanteEmpty
          icon={Database}
          title={copy.initialTitle}
          description={copy.initialDescription}
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-md bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando al SII"
        />
      )}

      {period && query.isError && <QavanteInlineError error={query.error} what={copy.errorWhat} />}

      {period && query.data && docs.length === 0 && (
        <QavanteEmpty icon={Inbox} title={copy.emptyTitle} description={copy.emptyDescription} />
      )}

      {period && docs.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{formatPeriodLabel(period)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <QavanteBadge variant="info">
                  {docs.length} {docs.length === 1 ? "documento" : "documentos"}
                </QavanteBadge>
                <span className="text-sm tabular-nums text-neutral-dark">
                  Total: <span className="font-semibold">{formatClp(total)}</span>
                </span>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-neutral-light text-left text-xs uppercase tracking-wide text-neutral-mid">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Fecha
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {copy.partyLabel}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Folio
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Neto
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    IVA
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr
                    key={`${d.folio ?? "x"}-${d.rut_contraparte ?? i}`}
                    className="border-b border-neutral-light/40 last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-neutral-dark">{d.fecha ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="block text-neutral-dark">
                        {d.razon_social ?? "Sin nombre"}
                      </span>
                      {d.rut_contraparte && (
                        <span className="block font-mono text-xs text-neutral-mid">
                          {d.rut_contraparte}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                      {d.folio ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                      {typeof d.monto_neto === "number" ? formatClp(d.monto_neto) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                      {typeof d.monto_iva === "number" ? formatClp(d.monto_iva) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-neutral-dark">
                      {typeof d.monto_total === "number" ? formatClp(d.monto_total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-mid">
            Datos descargados del SII en vivo. La suma del total es referencial y se calcula sobre
            los documentos mostrados — el dato oficial sigue siendo el del F29.
          </p>
        </QavanteCard>
      )}
    </div>
  );
}
