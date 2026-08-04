import { Landmark } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatDateLike } from "@/lib/formatters/date";
import type { BalanceData, CuentaSaldo } from "@/lib/api/treasury";
import { formatSaldo } from "./bank-balances-format";
import { lineaCreditoDe } from "./bank-balances-linea-credito";

/* Tarjeta presentacional de saldos de banco (BICE): una fila por cuenta con el
 * saldo DISPONIBLE al frente (número de oro) y el contable como referencia. Si la
 * cuenta tiene LÍNEA DE CRÉDITO, debajo del saldo muestra cuánto usa y cuánto le
 * queda (pedido de Fernando 2026-08-02). El contenedor `BankBalances` le pasa las
 * cuentas + el balance por cuenta (que trae la LC) desde los hooks. */

export interface BankBalancesCardProps {
  cuentas: CuentaSaldo[];
  /** Fecha de referencia del saldo (la más reciente entre las cuentas). */
  referencia?: string | null;
  /** Balance por cuenta (`numeroCuenta → BalanceData`) — de ahí sale la línea de crédito. */
  balancePorCuenta?: Map<string, BalanceData>;
}

export function BankBalancesCard({ cuentas, referencia, balancePorCuenta }: BankBalancesCardProps) {
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
          {cuentas.map((c) => {
            const lc = lineaCreditoDe(balancePorCuenta?.get(c.numeroCuenta));
            return (
              <li key={c.numeroCuenta} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                </div>
                {lc && (
                  <div className="mt-2 rounded-lg border border-border bg-neutral-light/20 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-xs font-medium text-neutral-dark">
                        Línea de crédito
                      </span>
                      <span className="text-xs text-neutral-mid">
                        te quedan{" "}
                        <b className="tabular-nums text-neutral-dark">
                          {formatSaldo(String(lc.disponible), lc.moneda ?? c.moneda)}
                        </b>{" "}
                        de{" "}
                        <span className="tabular-nums">
                          {formatSaldo(String(lc.cupo), lc.moneda ?? c.moneda)}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-neutral-mid">
                      Usás{" "}
                      <span className="tabular-nums">
                        {formatSaldo(String(lc.usado), lc.moneda ?? c.moneda)}
                      </span>{" "}
                      — es un colchón, no plata tuya
                      {lc.vencimientoSobregiro
                        ? ` · sobregiro vence el ${formatDateLike(lc.vencimientoSobregiro)}`
                        : ""}
                      .
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </QavanteCard>
  );
}
