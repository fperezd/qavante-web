import { Landmark } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatDateLike } from "@/lib/formatters/date";
import type { CuentaSaldo } from "@/lib/api/treasury";
import { formatSaldo } from "./bank-balances-format";

/* Tarjeta presentacional de saldos de banco (BICE): una fila por cuenta con el
 * saldo DISPONIBLE al frente (número de oro) y el contable como referencia. El
 * contenedor `BankBalances` le pasa las cuentas del hook. */

export interface BankBalancesCardProps {
  cuentas: CuentaSaldo[];
  /** Fecha de referencia del saldo (la más reciente entre las cuentas). */
  referencia?: string | null;
}

export function BankBalancesCard({ cuentas, referencia }: BankBalancesCardProps) {
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Saldos en banco
          </span>
          {referencia && (
            <span className="text-xs text-neutral-mid">al {formatDateLike(referencia)}</span>
          )}
        </div>
      }
    >
      {cuentas.length === 0 ? (
        <p className="text-sm text-neutral-mid">No hay cuentas de banco conectadas.</p>
      ) : (
        <ul className="divide-y divide-border">
          {cuentas.map((c) => (
            <li
              key={c.numeroCuenta}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-neutral-dark">
                  <span className="truncate">{c.nombreCuenta ?? "Cuenta"}</span>
                  <QavanteBadge variant="info">{c.moneda ?? "CLP"}</QavanteBadge>
                </p>
                {c.numeroFormateado && (
                  <p className="font-mono text-xs text-neutral-mid">{c.numeroFormateado}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-neutral-dark">
                  {formatSaldo(c.saldoDisponible, c.moneda)}
                </p>
                <p className="text-xs text-neutral-mid">
                  disponible · contable{" "}
                  <span className="tabular-nums">{formatSaldo(c.saldoContable, c.moneda)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </QavanteCard>
  );
}
