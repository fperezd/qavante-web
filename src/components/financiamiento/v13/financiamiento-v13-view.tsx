"use client";

import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { SinDato } from "@/components/rediseno/sin-dato";
import { concordar, formatCount } from "@/lib/formatters/count";
import {
  financingMoney,
  financingRate,
  type FinancingDimensionsView,
  type FinancingScheduledPaymentView,
  type FinancingV13Model,
} from "./financiamiento-v13-model";

export function FinanciamientoV13View({ model }: { model: FinancingV13Model }) {
  const kpiContrast =
    "[&>div:first-child]:!text-rediseno-tinta-2 [&>div:first-child>span]:!text-rediseno-tinta-2 [&>div:last-child]:!text-rediseno-tinta-2";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-rediseno-display text-[28px] leading-tight text-rediseno-tinta">
          Préstamos
        </h1>
        <p className="text-[12px] text-rediseno-tinta-2">Corte {model.cutOffLabel}</p>
      </div>

      {model.state !== "ready" && (
        <section
          aria-label="Datos pendientes"
          className="rounded-[14px] border border-rediseno-ambar-border bg-rediseno-ambar-soft px-4 py-3 text-[13px] text-rediseno-tinta"
        >
          Faltan datos de algunos préstamos.
        </section>
      )}

      <section aria-label="Resumen de préstamos" className="grid gap-3 sm:grid-cols-3">
        {model.principal === null ? (
          <KpiCard
            className={kpiContrast}
            label="Deuda total"
            sinDato={{ reason: "Saldo no disponible." }}
            period={model.currency}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Deuda total"
            value={financingMoney(model.principal, model.currency)}
            period={model.currency}
          />
        )}
        {model.comparableRatePct === null ? (
          <KpiCard
            className={kpiContrast}
            label="Tasa"
            sinDato={{ reason: "Tasa no disponible." }}
            period={model.currency}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Tasa"
            value={financingRate(model.comparableRatePct)}
            period={model.currency}
            detail={
              model.remainingCost === null
                ? undefined
                : `${financingMoney(model.remainingCost, model.currency)} de costo restante`
            }
          />
        )}
        {model.availableCapacity === null ? (
          <KpiCard
            className={kpiContrast}
            label="Cupo disponible"
            sinDato={{ reason: "Cupo no disponible." }}
            period={model.currency}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Cupo disponible"
            value={financingMoney(model.availableCapacity, model.currency)}
            period={model.currency}
          />
        )}
      </section>

      <section aria-labelledby="v13-deudas" className="space-y-2">
        <h2 id="v13-deudas" className="text-lg font-semibold text-rediseno-tinta">
          Tus préstamos
        </h2>
        {model.debts.length === 0 ? (
          <div
            role="status"
            className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-5 py-6 text-center text-[13px] text-rediseno-tinta-2"
          >
            No hay préstamos para mostrar.
          </div>
        ) : (
          <div
            aria-label="Detalle de préstamos"
            className="overflow-x-auto rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie"
            role="region"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead className="font-rediseno-mono text-[10.5px] uppercase tracking-[.08em] text-rediseno-tinta-2">
                <tr>
                  <th className="px-4 py-3">Préstamo</th>
                  <th className="px-4 py-3">Próxima cuota</th>
                  <th className="px-4 py-3">Tasa</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Costo restante</th>
                </tr>
              </thead>
              <tbody>
                {model.debts.map((debt) => (
                  <tr key={debt.id} className="border-t border-rediseno-hairline align-top">
                    <td className="max-w-[24rem] px-4 py-3">
                      <p className="font-medium text-rediseno-tinta">{debt.label}</p>
                      {debt.maturityLabel && (
                        <p className="mt-0.5 text-[12px] text-rediseno-tinta-2">
                          Vence {debt.maturityLabel}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-rediseno-tinta-2">
                      {debt.nextPayment === null ? (
                        <SinDato label="próxima cuota" reason="No disponible." />
                      ) : (
                        <>
                          {financingMoney(debt.nextPayment, model.currency)}
                          <span className="block text-[12px]">
                            {debt.nextPaymentDateLabel ?? "Fecha pendiente"}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-rediseno-tinta-2">
                      {debt.rateLabel ?? <SinDato label="tasa" reason="No disponible." />}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-rediseno-tinta">
                      {financingMoney(debt.principal, model.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rediseno-tinta-2">
                      {debt.remainingCost === null ? (
                        <SinDato label="costo" reason="No disponible." />
                      ) : (
                        financingMoney(debt.remainingCost, model.currency)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {model.alternatives.length > 0 && (
        <section aria-labelledby="v13-alternativas" className="space-y-2">
          <h2 id="v13-alternativas" className="text-lg font-semibold text-rediseno-tinta">
            Opciones
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {model.alternatives.map((alternative) => (
              <article
                key={alternative.id}
                className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium text-rediseno-tinta">{alternative.label}</h3>
                  <Pill
                    variant={alternative.isNoAction ? "blue" : "mut"}
                    className="!text-rediseno-tinta-2"
                  >
                    {alternative.stateLabel}
                  </Pill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                  <Metric
                    label="Costo total"
                    value={moneyOrUnknown(alternative.cost, model.currency)}
                  />
                  <Metric
                    label="Liquidez neta"
                    value={moneyOrUnknown(alternative.netLiquidity, model.currency)}
                  />
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      {model.tradeoffs.length > 0 && (
        <section aria-labelledby="v13-tradeoffs" className="space-y-2">
          <h2 id="v13-tradeoffs" className="text-lg font-semibold text-rediseno-tinta">
            Comparar refinanciamiento
          </h2>
          <div className="space-y-3">
            {model.tradeoffs.map((tradeoff) => (
              <article
                key={tradeoff.id}
                className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium text-rediseno-tinta">Préstamo actual y propuesta</h3>
                  <span className="text-[12px] text-rediseno-tinta-2">
                    Desde {tradeoff.closeDateLabel}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DimensionsPanel
                    title="Actual"
                    dimensions={tradeoff.current}
                    currency={model.currency}
                  />
                  <DimensionsPanel
                    title="Propuesta"
                    dimensions={tradeoff.proposed}
                    currency={model.currency}
                  />
                </div>
                <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-3">
                  <Metric
                    label="Cambio en costo"
                    value={moneyOrUnknown(tradeoff.totalCostDelta, model.currency)}
                  />
                  <Metric
                    label="Cambio en cuota máxima"
                    value={moneyOrUnknown(tradeoff.maximumServiceDelta, model.currency)}
                  />
                  <Metric label="Cambio en plazo" value={signedDays(tradeoff.durationDeltaDays)} />
                </dl>
                <details className="mt-3 border-t border-rediseno-hairline pt-2">
                  <summary className="cursor-pointer text-[12px] font-medium text-brand-primary">
                    Ver cuotas
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ScheduleDetails
                      title="Cuotas actuales"
                      payments={tradeoff.currentSchedule}
                      currency={model.currency}
                    />
                    <ScheduleDetails
                      title="Cuotas propuestas"
                      payments={tradeoff.proposedSchedule}
                      currency={model.currency}
                    />
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-rediseno-tinta-2">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-rediseno-tinta">{value}</dd>
    </div>
  );
}

function DimensionsPanel({
  title,
  dimensions,
  currency,
}: {
  title: string;
  dimensions: FinancingDimensionsView;
  currency: string;
}) {
  return (
    <section className="rounded-[10px] border border-rediseno-hairline px-3 py-2.5">
      <h4 className="text-[12px] font-medium text-rediseno-tinta">{title}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
        <Metric
          label="Costo total"
          value={moneyOrUnknown(dimensions.totalFinancialCost, currency)}
        />
        <Metric label="Liquidez neta" value={moneyOrUnknown(dimensions.netLiquidity, currency)} />
        <Metric
          label="Cuota máxima"
          value={moneyOrUnknown(dimensions.maximumDebtService, currency)}
        />
        <Metric label="Plazo" value={daysOrUnknown(dimensions.durationDays)} />
      </dl>
    </section>
  );
}

function ScheduleDetails({
  title,
  payments,
  currency,
}: {
  title: string;
  payments: FinancingScheduledPaymentView[];
  currency: string;
}) {
  return (
    <section className="rounded-[10px] border border-rediseno-hairline px-3 py-2.5 text-[12px]">
      <h4 className="font-medium text-rediseno-tinta">{title}</h4>
      {payments.length === 0 ? (
        <p className="mt-1 text-rediseno-tinta-2">Sin cuotas.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-rediseno-tinta-2">
          {payments.map((payment, index) => (
            <li
              key={`${payment.dueDateLabel}:${index}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span>{payment.dueDateLabel}</span>
              <span className="font-medium tabular-nums text-rediseno-tinta">
                {moneyOrUnknown(payment.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function moneyOrUnknown(value: number | null, currency: string): string {
  return value === null ? "Sin dato" : financingMoney(value, currency);
}

function daysOrUnknown(value: number | null): string {
  return value === null ? "Sin dato" : `${formatCount(value)} ${concordar(value, "día", "días")}`;
}

function signedDays(value: number): string {
  if (value < 0)
    return `−${formatCount(Math.abs(value))} ${concordar(Math.abs(value), "día", "días")}`;
  if (value > 0) return `+${formatCount(value)} ${concordar(value, "día", "días")}`;
  return "Sin cambio";
}
