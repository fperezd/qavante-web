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
  /** La consulta de líneas de crédito (balance por cuenta) todavía carga → las cuentas muestran
   *  "cargando línea de crédito…" en vez de omitirla (esa consulta es más lenta). */
  lcLoading?: boolean;
  /** Saldo de cuentas (`/api/bice/saldo`) aún cargando → skeleton en la sección Cuentas (BICE responde
   *  lento, scrape en vivo). Render progresivo: cada sección aparece apenas llega, sin bloquear la otra. */
  cuentasLoading?: boolean;
  /** Tarjetas (`/api/bice/tarjetas`) aún cargando → skeleton en la sección Tarjetas. */
  tarjetasLoading?: boolean;
}

/** Placeholder de un par de productos mientras BICE responde. */
function ProductosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-busy="true">
      <div className="h-24 animate-pulse rounded-xl bg-neutral-light/40" />
      <div className="h-24 animate-pulse rounded-xl bg-neutral-light/40" />
    </div>
  );
}

export function BancoBankCard({
  banco,
  referencia,
  cuentas,
  tarjetas,
  lcLoading,
  cuentasLoading,
  tarjetasLoading,
}: BancoConProductos) {
  const mostrarCuentas = cuentas.length > 0 || cuentasLoading;
  const mostrarTarjetas = tarjetas.length > 0 || tarjetasLoading;
  const vacio = !mostrarCuentas && !mostrarTarjetas;
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
          {mostrarCuentas && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Cuentas corrientes
              </h3>
              {cuentas.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {cuentas.map(({ cuenta, balance }) => (
                    <CuentaCorrienteItem
                      key={cuenta.numeroCuenta}
                      cuenta={cuenta}
                      balance={balance}
                      lcLoading={lcLoading}
                    />
                  ))}
                </div>
              ) : (
                <ProductosSkeleton />
              )}
            </div>
          )}
          {mostrarTarjetas && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Tarjetas de crédito
              </h3>
              {tarjetas.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {tarjetas.map(({ tarjeta, cupos }) => (
                    <TarjetaCreditoItem
                      key={tarjeta.operationNumber}
                      tarjeta={tarjeta}
                      cupos={cupos}
                    />
                  ))}
                </div>
              ) : (
                <ProductosSkeleton />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
