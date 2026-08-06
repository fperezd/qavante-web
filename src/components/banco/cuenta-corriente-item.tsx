import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatSaldo } from "@/components/treasury/bank-balances/bank-balances-format";
import { lineaCreditoDe } from "@/components/treasury/bank-balances/bank-balances-linea-credito";
import type { BalanceData, CuentaSaldo } from "@/lib/api/treasury";

/* Un producto CUENTA CORRIENTE: el número de oro es el saldo DISPONIBLE, con el contable de contexto y,
   si la cuenta tiene LÍNEA DE CRÉDITO, cuánto queda (o "agotada"). Presentacional PURO. Simple. */

export interface CuentaCorrienteItemProps {
  cuenta: CuentaSaldo;
  /** Balance detallado (trae la línea de crédito); opcional. */
  balance?: BalanceData;
  /** La consulta de la LÍNEA DE CRÉDITO (balance por cuenta) todavía carga: mostramos "cargando…" en
   *  vez de nada, para que no parezca que la cuenta no tiene línea (esa consulta es más lenta — scrape
   *  aparte de BICE). */
  lcLoading?: boolean;
}

export function CuentaCorrienteItem({ cuenta: c, balance, lcLoading }: CuentaCorrienteItemProps) {
  const lc = lineaCreditoDe(balance);
  const mon = lc?.moneda ?? c.moneda;
  const agotada = lc ? lc.disponible <= 0 : false;
  return (
    <Link
      href={`/banco/cuenta/${encodeURIComponent(c.numeroCuenta)}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      aria-label={`Ver movimientos de ${c.nombreCuenta ?? "la cuenta"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-neutral-dark">
          <Wallet className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span className="truncate">{c.nombreCuenta ?? "Cuenta corriente"}</span>
          <QavanteBadge variant="info">{c.moneda ?? "CLP"}</QavanteBadge>
        </span>
        <span className="flex items-center gap-2">
          {c.numeroFormateado && (
            <span className="font-mono text-xs text-neutral-mid">{c.numeroFormateado}</span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-2 text-lg font-bold tabular-nums text-neutral-dark">
        {formatSaldo(c.saldoDisponible, c.moneda)}
      </p>
      <p className="text-xs text-neutral-mid">
        disponible · contable{" "}
        <span className="tabular-nums">{formatSaldo(c.saldoContable, c.moneda)}</span>
      </p>

      {lc && (
        <p className="mt-2 border-t border-dashed border-border pt-2 text-[11px] text-neutral-mid">
          <span className="font-medium text-neutral-dark">Línea de crédito:</span>{" "}
          {agotada ? (
            <span className="font-medium text-warning-700">
              cupo agotado
              {lc.disponible < 0 && <> · excedido {formatMoney(Math.abs(lc.disponible), mon)}</>}
            </span>
          ) : (
            <>
              te quedan{" "}
              <b className="tabular-nums text-neutral-dark">{formatMoney(lc.disponible, mon)}</b> de{" "}
              <span className="tabular-nums">{formatMoney(lc.cupo, mon)}</span>
            </>
          )}
          {lc.vencimientoSobregiro && <> · vence el {formatDateLike(lc.vencimientoSobregiro)}</>}
        </p>
      )}
      {!lc && lcLoading && (
        <p className="mt-2 border-t border-dashed border-border pt-2 text-[11px] text-neutral-mid">
          <span className="inline-block h-3 w-40 animate-pulse rounded bg-neutral-light/50 align-middle" />{" "}
          <span className="sr-only">Cargando línea de crédito…</span>
        </p>
      )}
    </Link>
  );
}
