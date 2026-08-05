import { Landmark } from "lucide-react";
import { formatDateLike } from "@/lib/formatters/date";
import type { BalanceData, CuentaSaldo, TarjetaCredito } from "@/lib/api/treasury";
import { CuentaCorrienteItem } from "./cuenta-corriente-item";
import { TarjetaCreditoItem } from "./tarjeta-credito-item";
import type { CupoTarjeta } from "./banco-model";

/* Un BANCO y sus PRODUCTOS (convención de los bancos): cuentas corrientes + tarjetas de crédito. La
   pantalla monta una sección de estas por banco conectado (hoy BICE; mañana Santander u otro). UX
   simple y escaneable (pedido de Fernando): cada producto en su tarjeta, en una grilla que se lee de
   corrido. Presentacional PURO. */

export interface BancoConProductos {
  /** Nombre del banco ("BICE"). */
  banco: string;
  /** Fecha de referencia de los saldos (la más reciente), opcional. */
  referencia?: string | null;
  cuentas: { cuenta: CuentaSaldo; balance?: BalanceData }[];
  tarjetas: { tarjeta: TarjetaCredito; cupos: CupoTarjeta[] }[];
}

export function BancoBankCard({ banco, referencia, cuentas, tarjetas }: BancoConProductos) {
  const vacio = cuentas.length === 0 && tarjetas.length === 0;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface-muted/40 shadow-sm"
      aria-label={`Banco ${banco}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-5 py-3">
        <span className="flex items-center gap-2 text-base font-bold text-neutral-dark">
          <Landmark className="h-5 w-5 text-brand-primary" aria-hidden="true" />
          {banco}
        </span>
        {referencia && (
          <span className="text-xs text-neutral-mid">al {formatDateLike(referencia)}</span>
        )}
      </div>

      {vacio ? (
        <p className="px-5 py-6 text-sm text-neutral-mid">
          No hay productos para mostrar en este banco.
        </p>
      ) : (
        <div className="space-y-5 p-5">
          {cuentas.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Cuentas corrientes
              </h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {cuentas.map(({ cuenta, balance }) => (
                  <CuentaCorrienteItem
                    key={cuenta.numeroCuenta}
                    cuenta={cuenta}
                    balance={balance}
                  />
                ))}
              </div>
            </div>
          )}
          {tarjetas.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Tarjetas de crédito
              </h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {tarjetas.map(({ tarjeta, cupos }) => (
                  <TarjetaCreditoItem
                    key={tarjeta.operationNumber}
                    tarjeta={tarjeta}
                    cupos={cupos}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
