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
                {lc &&
                  (() => {
                    const mon = lc.moneda ?? c.moneda;
                    // Cupo agotado / excedido (disponible ≤ 0): NO es un "colchón" — no queda margen. El
                    // exceso (disponible < 0) es plata que ya te pasaste del cupo aprobado. Honesto vs
                    // "te quedan −$X" (que se lee mal).
                    const agotada = lc.disponible <= 0;
                    const excedido = lc.disponible < 0;
                    const venc = lc.vencimientoSobregiro
                      ? ` · sobregiro vence el ${formatDateLike(lc.vencimientoSobregiro)}`
                      : "";
                    return (
                      <div
                        className={`mt-2 rounded-lg border px-3 py-2 ${agotada ? "border-warning-500/40 bg-warning-500/[.07]" : "border-border bg-neutral-light/20"}`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="text-xs font-medium text-neutral-dark">
                            Línea de crédito
                          </span>
                          {agotada ? (
                            <span className="text-xs font-medium text-warning-700">
                              {excedido ? (
                                <>
                                  cupo agotado · excedido{" "}
                                  <b className="tabular-nums">
                                    {formatSaldo(String(Math.abs(lc.disponible)), mon)}
                                  </b>
                                </>
                              ) : (
                                "cupo agotado"
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-mid">
                              te quedan{" "}
                              <b className="tabular-nums text-neutral-dark">
                                {formatSaldo(String(lc.disponible), mon)}
                              </b>{" "}
                              de{" "}
                              <span className="tabular-nums">
                                {formatSaldo(String(lc.cupo), mon)}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-neutral-mid">
                          Usas{" "}
                          <span className="tabular-nums">{formatSaldo(String(lc.usado), mon)}</span>{" "}
                          de{" "}
                          <span className="tabular-nums">{formatSaldo(String(lc.cupo), mon)}</span>
                          {agotada ? ", sin margen disponible" : ", es un colchón, no plata tuya"}
                          {venc}.
                        </p>
                      </div>
                    );
                  })()}
              </li>
            );
          })}
        </ul>
      )}
    </QavanteCard>
  );
}
