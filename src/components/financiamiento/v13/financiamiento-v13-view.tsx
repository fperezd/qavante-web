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

export interface FinanciamientoV13ViewProps {
  model: FinancingV13Model;
}

export function FinanciamientoV13View({ model }: FinanciamientoV13ViewProps) {
  const evidenceDetail = `${model.evidenceLabel} · ${model.freshnessLabel}`;
  const kpiContrast =
    "[&>div:first-child]:!text-rediseno-tinta-2 [&>div:first-child>span]:!text-rediseno-tinta-2 [&>div:last-child]:!text-rediseno-tinta-2";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-2">
            Financiamiento
          </p>
          <h1 className="mt-1 font-rediseno-display text-[28px] leading-tight text-rediseno-tinta">
            ¿Te conviene financiarte?
          </h1>
          <p className="mt-1 text-[13px] text-rediseno-tinta-2">
            Una vista verificable de tu deuda y de las alternativas que el motor puede comparar.
          </p>
        </div>
        <div className="text-right text-[12px] text-rediseno-tinta-2">
          <p>{model.coverageLabel}</p>
          <p>{model.freshnessLabel}</p>
          <p>Corte {model.cutOffLabel}</p>
        </div>
      </div>

      {model.state !== "ready" && (
        <section
          aria-label="Cobertura de los datos"
          className="rounded-[14px] border border-rediseno-ambar-border bg-rediseno-ambar-soft px-4 py-3 text-[13px] text-rediseno-tinta-2"
        >
          <strong className="text-rediseno-tinta">
            {model.state === "abstained"
              ? "Qavante todavía no puede recomendar sobre esta deuda."
              : "La lectura es parcial."}
          </strong>{" "}
          Faltan fuentes verificables y no las reemplazamos por cero ni por una oferta supuesta.
          {model.reasons.length > 0 && (
            <span className="mt-1 block text-[12px] text-rediseno-tinta-2">
              Evidencia pendiente · {model.reasons.join(" · ")}
            </span>
          )}
        </section>
      )}

      <section aria-label="Deuda, costo y cupo" className="grid gap-3 sm:grid-cols-3">
        {model.principal === null ? (
          <KpiCard
            className={kpiContrast}
            label="Deuda vigente"
            sinDato={{ reason: "El corte no certifica el principal completo para este scope." }}
            period={model.currency}
            detail={`${model.coverageLabel} · ${evidenceDetail}`}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Deuda vigente"
            value={financingMoney(model.principal, model.currency)}
            period={model.currency}
            detail={`${model.coverageLabel} · ${evidenceDetail}`}
          />
        )}

        {model.comparableRatePct === null ? (
          <KpiCard
            className={kpiContrast}
            label="Costo comparable"
            sinDato={{ reason: "No hay una tasa comparable certificada para toda la deuda." }}
            period={model.currency}
            detail={evidenceDetail}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Costo comparable"
            value={financingRate(model.comparableRatePct)}
            period={model.currency}
            detail={`${
              model.remainingCost === null
                ? "Costo absoluto restante sin dato"
                : `${financingMoney(model.remainingCost, model.currency)} de costo restante`
            } · ${evidenceDetail}`}
          />
        )}

        {model.availableCapacity === null ? (
          <KpiCard
            className={kpiContrast}
            label="Cupo disponible"
            sinDato={{ reason: "No existe capacidad disponible verificada en el corte." }}
            period={model.currency}
            detail={evidenceDetail}
          />
        ) : (
          <KpiCard
            className={kpiContrast}
            label="Cupo disponible"
            value={financingMoney(model.availableCapacity, model.currency)}
            period={model.currency}
            detail={`Capacidad verificada · no es una oferta · ${evidenceDetail}`}
          />
        )}
      </section>

      <section aria-labelledby="v13-deudas" className="space-y-2">
        <h2
          id="v13-deudas"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-2"
        >
          Tu deuda vigente
        </h2>
        {model.debts.length === 0 ? (
          <div
            role="status"
            className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-5 py-6 text-center"
          >
            <p className="font-medium text-rediseno-tinta">Deuda sin dato verificable</p>
            <p className="mt-1 text-[13px] text-rediseno-tinta-2">
              El scope no entregó una fila publicable. Esto no afirma que tu deuda sea cero.
            </p>
          </div>
        ) : (
          <div
            aria-label="Detalle desplazable de deuda vigente"
            className="overflow-x-auto rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie"
            role="region"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead className="font-rediseno-mono text-[10.5px] uppercase tracking-[.08em] text-rediseno-tinta-2">
                <tr>
                  <th className="px-4 py-3">Instrumento</th>
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
                      <p className="mt-0.5 break-words text-[12px] text-rediseno-tinta-2">
                        {debt.detail}
                        {debt.maturityLabel ? ` · vence ${debt.maturityLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-rediseno-tinta-2">
                      {debt.nextPayment === null ? (
                        <SinDato label="próxima cuota" reason="Monto o fecha no certificados." />
                      ) : (
                        <>
                          {financingMoney(debt.nextPayment, model.currency)}
                          <span className="block text-[12px] text-rediseno-tinta-2">
                            {debt.nextPaymentDateLabel ?? "fecha sin dato"}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-rediseno-tinta-2">
                      {debt.rateLabel ?? (
                        <SinDato label="tasa" reason="Contrato sin tasa comparable." />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-rediseno-tinta">
                      {financingMoney(debt.principal, model.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rediseno-tinta-2">
                      {debt.remainingCost === null ? (
                        <SinDato label="costo" reason="Costo restante no certificado." />
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

      <section aria-labelledby="v13-alternativas" className="space-y-2">
        <h2
          id="v13-alternativas"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-2"
        >
          Alternativas y abstenciones
        </h2>
        {model.evaluation && (
          <div className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-4 py-3 text-[13px] text-rediseno-tinta-2">
            <p className="font-medium text-rediseno-tinta">
              Evaluación del motor · {model.evaluation.stateLabel}
            </p>
            {model.evaluation.reasons.length > 0 && (
              <p className="mt-1">Motivos · {model.evaluation.reasons.join(" · ")}</p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {model.evaluation.scopes.map((scope) => (
                <div key={scope.label}>
                  <span className="font-medium text-rediseno-tinta">{scope.label}</span>
                  <span> · {scope.stateLabel}</span>
                  {scope.reasons.length > 0 && (
                    <span className="block text-[12px]">{scope.reasons.join(" · ")}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {model.alternatives.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-5 py-6 text-[13px] text-rediseno-tinta-2">
            No hay alternativas comparables para este corte. Qavante se abstiene de inventar una
            oferta o una elegibilidad.
          </div>
        ) : (
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
                  <div>
                    <dt className="text-rediseno-tinta-2">Costo total</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-rediseno-tinta">
                      {alternative.cost === null
                        ? "Sin dato"
                        : financingMoney(alternative.cost, model.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-rediseno-tinta-2">Liquidez neta</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-rediseno-tinta">
                      {alternative.netLiquidity === null
                        ? "Sin dato"
                        : financingMoney(alternative.netLiquidity, model.currency)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[12px] text-rediseno-tinta-2">
                  Elegibilidad · {alternative.eligibilityLabel}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-rediseno-tinta-2">
                  {alternative.stateLabel === "Referencia indicativa"
                    ? "Referencia para comparar · no es una oferta y no se puede aceptar desde Qavante."
                    : alternative.isNoAction
                      ? "La opción de no financiar siempre se conserva en la comparación."
                      : "Sólo lectura · esta pantalla no solicita ni ejecuta financiamiento."}
                </p>
                {alternative.reasons.length > 0 && (
                  <p className="mt-2 text-[12px] leading-relaxed text-rediseno-tinta-2">
                    Motivos · {alternative.reasons.join(" · ")}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="v13-combinaciones" className="space-y-2">
        <h2
          id="v13-combinaciones"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-2"
        >
          Combinaciones verificadas
        </h2>
        {model.combinations.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-5 py-4 text-[13px] text-rediseno-tinta-2">
            El motor no entregó una combinación publicable para este corte. Esto no reemplaza una
            combinación por una suma hecha en el navegador.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {model.combinations.map((combination) => (
              <article
                key={combination.id}
                className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
              >
                <h3 className="font-medium text-rediseno-tinta">
                  {combination.componentLabels.join(" + ")}
                </h3>
                <p className="mt-1 break-words text-[12px] text-rediseno-tinta-2">
                  Regla · {combination.appliedRule} · Política · {combination.policyRef}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                  <Metric
                    label="Costo total"
                    value={moneyOrUnknown(combination.cost, model.currency)}
                  />
                  <Metric
                    label="Liquidez neta"
                    value={moneyOrUnknown(combination.netLiquidity, model.currency)}
                  />
                  <Metric
                    label="Mayor servicio"
                    value={moneyOrUnknown(combination.maximumDebtService, model.currency)}
                  />
                  <Metric label="Duración" value={daysOrUnknown(combination.durationDays)} />
                  <Metric
                    label="Concentración de pagos"
                    value={moneyOrUnknown(combination.paymentConcentration, model.currency)}
                  />
                  <Metric label="Garantías" value={guaranteesOrUnknown(combination.guarantees)} />
                </dl>
              </article>
            ))}
          </div>
        )}
        {model.evaluation &&
          (model.evaluation.excludedCombinationCount > 0 ||
            model.evaluation.combinationsTruncated) && (
            <div className="rounded-[14px] border border-rediseno-ambar-border bg-rediseno-ambar-soft px-4 py-3 text-[12px] text-rediseno-tinta-2">
              {model.evaluation.excludedCombinationCount > 0 && (
                <p>
                  {model.evaluation.excludedCombinationCount}{" "}
                  {concordar(
                    model.evaluation.excludedCombinationCount,
                    "combinación excluida",
                    "combinaciones excluidas",
                  )}{" "}
                  por el motor.
                </p>
              )}
              {model.evaluation.combinationsTruncated && (
                <p>
                  Resultado limitado por el backend
                  {model.evaluation.maxCombinations === null
                    ? "."
                    : ` a ${model.evaluation.maxCombinations} ${concordar(
                        model.evaluation.maxCombinations,
                        "combinación",
                        "combinaciones",
                      )}.`}
                </p>
              )}
              {model.evaluation.excludedCombinationReasons.length > 0 && (
                <p className="mt-1">
                  Motivos · {model.evaluation.excludedCombinationReasons.join(" · ")}
                </p>
              )}
            </div>
          )}
      </section>

      <section aria-labelledby="v13-tradeoffs" className="space-y-2">
        <h2
          id="v13-tradeoffs"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-2"
        >
          Antes y después del refinanciamiento
        </h2>
        {model.tradeoffs.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-5 py-4 text-[13px] text-rediseno-tinta-2">
            No hay un trade-off verificable para este corte. No inferimos uno desde las cuotas.
          </div>
        ) : (
          <div className="space-y-3">
            {model.tradeoffs.map((tradeoff) => (
              <article
                key={tradeoff.id}
                className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium text-rediseno-tinta">Cambio de obligación evaluado</h3>
                  <span className="text-[12px] text-rediseno-tinta-2">
                    Cierre {tradeoff.closeDateLabel}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DimensionsPanel
                    title="Actual"
                    dimensions={tradeoff.current}
                    currency={model.currency}
                  />
                  <DimensionsPanel
                    title="Propuesto"
                    dimensions={tradeoff.proposed}
                    currency={model.currency}
                  />
                </div>
                <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Cambio en costo total"
                    value={moneyOrUnknown(tradeoff.totalCostDelta, model.currency)}
                  />
                  <Metric
                    label="Cambio en cuota máxima"
                    value={moneyOrUnknown(tradeoff.maximumServiceDelta, model.currency)}
                  />
                  <Metric
                    label="Cambio en duración"
                    value={signedDays(tradeoff.durationDeltaDays)}
                  />
                  <Metric
                    label="Cambio en concentración"
                    value={moneyOrUnknown(tradeoff.paymentConcentrationDelta, model.currency)}
                  />
                </dl>
                <p className="mt-3 text-[12px] text-rediseno-tinta-2">
                  Calendario actual · {formatCount(tradeoff.currentPaymentCount)}{" "}
                  {concordar(tradeoff.currentPaymentCount, "pago", "pagos")} · Calendario propuesto
                  · {formatCount(tradeoff.proposedPaymentCount)}{" "}
                  {concordar(tradeoff.proposedPaymentCount, "pago", "pagos")}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ScheduleDetails
                    title="Detalle del calendario actual"
                    payments={tradeoff.currentSchedule}
                    currency={model.currency}
                  />
                  <ScheduleDetails
                    title="Detalle del calendario propuesto"
                    payments={tradeoff.proposedSchedule}
                    currency={model.currency}
                  />
                </div>
                {(tradeoff.guaranteesAdded.length > 0 || tradeoff.guaranteesRemoved.length > 0) && (
                  <div className="mt-2 text-[12px] text-rediseno-tinta-2">
                    {tradeoff.guaranteesAdded.length > 0 && (
                      <p>Garantías agregadas · {tradeoff.guaranteesAdded.join(" · ")}</p>
                    )}
                    {tradeoff.guaranteesRemoved.length > 0 && (
                      <p>Garantías retiradas · {tradeoff.guaranteesRemoved.join(" · ")}</p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-4 py-3 text-[12.5px] text-rediseno-tinta-2">
        Qavante puede recomendarte no financiar. La suscripción no depende de que tomes
        financiamiento. Esta pantalla compara evidencia · no acepta ofertas, no firma y no mueve
        dinero.
      </footer>
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
          label="Mayor servicio"
          value={moneyOrUnknown(dimensions.maximumDebtService, currency)}
        />
        <Metric label="Duración" value={daysOrUnknown(dimensions.durationDays)} />
        <Metric
          label="Concentración de pagos"
          value={moneyOrUnknown(dimensions.paymentConcentration, currency)}
        />
        <Metric label="Garantías" value={guaranteesOrUnknown(dimensions.guarantees)} />
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
        <p className="mt-1 text-rediseno-tinta-2">Sin pagos en el calendario entregado.</p>
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

function guaranteesOrUnknown(values: string[] | null): string {
  if (values === null) return "Sin dato";
  return values.length === 0 ? "Sin garantías" : values.join(" · ");
}

function signedDays(value: number): string {
  if (value < 0)
    return `−${formatCount(Math.abs(value))} ${concordar(Math.abs(value), "día", "días")}`;
  if (value > 0) return `+${formatCount(value)} ${concordar(value, "día", "días")}`;
  return "Sin cambio";
}
