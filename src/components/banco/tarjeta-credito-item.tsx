import Link from "next/link";
import { CreditCard, ChevronRight } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import type { TarjetaCredito } from "@/lib/api/treasury";
import type { CupoTarjeta } from "./banco-model";

/* Un producto TARJETA DE CRÉDITO: el número de oro es el DISPONIBLE del cupo (lo que puedes gastar),
   con el usado y el cupo total de contexto + facturado y vencimiento del pago. Presentacional PURO.
   Simple y escaneable (pedido de Fernando): una fila por moneda (CLP/USD). */

export interface TarjetaCreditoItemProps {
  tarjeta: TarjetaCredito;
  cupos: CupoTarjeta[];
}

export function TarjetaCreditoItem({ tarjeta, cupos }: TarjetaCreditoItemProps) {
  const nombre = tarjeta.product || "Tarjeta de crédito";
  return (
    <Link
      href={`/banco/tarjeta/${encodeURIComponent(tarjeta.operationNumber)}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      aria-label={`Ver movimientos de ${nombre}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-neutral-dark">
          <CreditCard className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          {nombre}
        </span>
        <span className="flex items-center gap-2">
          {tarjeta.isActive ? (
            <span className="font-mono text-xs text-neutral-mid">
              ····{tarjeta.operationNumber.slice(-4)}
            </span>
          ) : (
            <QavanteBadge variant="warning">Inactiva</QavanteBadge>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
        </span>
      </div>
      {tarjeta.holder && <p className="mt-0.5 text-xs text-neutral-mid">{tarjeta.holder}</p>}

      {cupos.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-mid">Sin cupo informado.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {cupos.map((c) => {
            const usoPct = c.total > 0 ? Math.min(100, Math.max(0, (c.usado / c.total) * 100)) : 0;
            return (
              <li key={c.moneda}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-mid">{c.moneda}</span>
                  <span className="text-sm tabular-nums text-neutral-dark">
                    Disponible <b>{formatMoney(c.disponible, c.moneda)}</b>{" "}
                    <span className="text-neutral-mid">de {formatMoney(c.total, c.moneda)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="animate-qv-grow-x h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-primary/45"
                    style={{ width: `${usoPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-mid">
                  Usado <span className="tabular-nums">{formatMoney(c.usado, c.moneda)}</span>
                  {c.facturado != null && (
                    <>
                      {" · "}facturado{" "}
                      <span className="tabular-nums">{formatMoney(c.facturado, c.moneda)}</span>
                    </>
                  )}
                  {c.vencimiento && <> · vence el {formatDateLike(c.vencimiento)}</>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Link>
  );
}
