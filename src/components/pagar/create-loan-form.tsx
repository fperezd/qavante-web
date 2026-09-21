"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useCreateLoan } from "@/lib/api/obligations";
import { formatMoney } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { loanPreview, monthlyRateFromPayment } from "./loan-amortization";
import {
  LOAN_CURRENCIES,
  loanCurrencyMeta,
  parseAmount,
  principalForApi,
  retypeAmount,
  sanitizeAmountInput,
  type LoanCurrency,
} from "./loan-currency";

/* Alta de préstamo. El usuario carga capital, tasa MENSUAL (%), cuotas y primer
   vencimiento; el backend deriva el calendario (amortización francesa). Mostramos
   un preview de la cuota antes de enviar. Al crear, vamos al detalle. La MONEDA la
   elige el usuario —peso, UF o dólar, un crédito PYME chileno viene en cualquiera de
   las tres— y el backend ya la aceptaba (`currency_code`); acá estaba clavada en CLP.
   Fechas con input nativo (valor YYYY-MM-DD para el backend, display DD-MM-AAAA en
   navegador chileno). Gated por `obligations`. */

const inputClass =
  "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function CreateLoanForm() {
  const router = useRouter();
  const create = useCreateLoan();

  const [counterparty, setCounterparty] = React.useState("");
  const [currency, setCurrency] = React.useState<LoanCurrency>("CLP");
  /* Un crédito real rara vez llega con la tasa a la vista: llega con una cuota que ya
     trae adentro comisión de apertura, impuesto DL 3475 y seguros. Por eso se puede
     cargar por CUOTA y el formulario deriva la tasa (efectiva) que la reproduce. */
  const [mode, setMode] = React.useState<"rate" | "payment">("rate");
  const [paymentRaw, setPaymentRaw] = React.useState("");
  const [principalRaw, setPrincipalRaw] = React.useState("");
  const [ratePct, setRatePct] = React.useState("");
  const [installments, setInstallments] = React.useState("");
  const [firstDue, setFirstDue] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const currencyMeta = loanCurrencyMeta(currency);
  const principal = parseAmount(principalRaw, currency);
  const n = Number(installments);
  const payment = parseAmount(paymentRaw, currency);
  /* En modo cuota la tasa sale del solver; `null` (cuota que no cierra) se trata igual
     que una tasa vacía: inválida, y el formulario no deja enviar. */
  const derivedRate =
    mode === "payment" && payment > 0 && principal > 0 && n >= 1
      ? monthlyRateFromPayment(principal, payment, n)
      : null;
  const monthlyRate =
    mode === "payment" ? (derivedRate ?? NaN) : ratePct.trim() === "" ? NaN : Number(ratePct) / 100;

  const counterpartyValid = counterparty.trim().length >= 1;
  const principalValid = principal > 0;
  const rateValid = Number.isFinite(monthlyRate) && monthlyRate >= 0;
  const installmentsValid = Number.isInteger(n) && n >= 1 && n <= 600;
  const dueValid = /^\d{4}-\d{2}-\d{2}$/.test(firstDue);
  const canSubmit =
    counterpartyValid && principalValid && rateValid && installmentsValid && dueValid;

  const preview =
    rateValid && principalValid && installmentsValid
      ? loanPreview(principal, monthlyRate, n, currencyMeta.decimals)
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    create.mutate(
      {
        counterparty: counterparty.trim(),
        principal: principalForApi(principalRaw, currency),
        // `toFixed` evita notación científica (ej. 5e-7) y el ruido de float
        // (ej. 0.0289999…998) en este campo decimal de dinero. El backend
        // (Decimal) parsea ceros finales sin problema.
        monthly_rate: monthlyRate.toFixed(8),
        installments: n,
        first_due_date: firstDue,
        currency_code: currency,
      },
      {
        onSuccess: (res) => router.push(`/pagar/obligaciones/${res.obligation.id}`),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-4">
      <QavanteCard variant="bordered">
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="loan-counterparty" className="text-sm font-medium text-neutral-dark">
              Acreedor
            </label>
            <QavanteInput
              id="loan-counterparty"
              placeholder="Nombre del banco"
              value={counterparty}
              onValueChange={setCounterparty}
              invalid={touched && !counterpartyValid}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="loan-currency" className="text-sm font-medium text-neutral-dark">
              Moneda
            </label>
            <select
              id="loan-currency"
              value={currency}
              onChange={(e) => {
                const next = e.target.value as LoanCurrency;
                setCurrency(next);
                // Los montos ya escritos se recortan a los decimales de la moneda nueva
                // (nunca se pegan: ver `retypeAmount`). La CUOTA también: si no, el campo
                // muestra decimales que la moneda no admite y la tasa efectiva se deriva
                // sobre otro número del que se ve — y esa tasa es la que viaja al backend.
                setPrincipalRaw((raw) => retypeAmount(raw, next));
                setPaymentRaw((raw) => retypeAmount(raw, next));
              }}
              className={inputClass}
            >
              {LOAN_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="loan-mode" className="text-sm font-medium text-neutral-dark">
              ¿Qué dato tienes del crédito?
            </label>
            <select
              id="loan-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as "rate" | "payment")}
              className={inputClass}
            >
              <option value="rate">La tasa mensual</option>
              <option value="payment">La cuota mensual</option>
            </select>
            <p className="text-xs text-neutral-mid">
              Si cargas la cuota, Qavante calcula la tasa que la explica. Esa tasa es la efectiva:
              incluye los gastos que el acreedor ya metió adentro (comisión de apertura, impuesto de
              timbres, seguros), así que es la que sirve para comparar un crédito con otro.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="loan-principal" className="text-sm font-medium text-neutral-dark">
                Capital ({currency})
              </label>
              <input
                id="loan-principal"
                inputMode={currencyMeta.decimals === 0 ? "numeric" : "decimal"}
                autoComplete="off"
                placeholder={currencyMeta.placeholder}
                value={principalRaw}
                onChange={(e) => setPrincipalRaw(sanitizeAmountInput(e.target.value, currency))}
                className={`${inputClass} tabular-nums`}
              />
            </div>

            {mode === "rate" ? (
              <div className="space-y-1">
                <label htmlFor="loan-rate" className="text-sm font-medium text-neutral-dark">
                  Tasa mensual (%)
                </label>
                <input
                  id="loan-rate"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="1,5"
                  value={ratePct}
                  onChange={(e) => setRatePct(e.target.value.replace(",", "."))}
                  className={inputClass}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label htmlFor="loan-payment" className="text-sm font-medium text-neutral-dark">
                  Cuota mensual ({currency})
                </label>
                <input
                  id="loan-payment"
                  inputMode={currencyMeta.decimals === 0 ? "numeric" : "decimal"}
                  autoComplete="off"
                  placeholder="938.187"
                  value={paymentRaw}
                  onChange={(e) => setPaymentRaw(sanitizeAmountInput(e.target.value, currency))}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="loan-installments" className="text-sm font-medium text-neutral-dark">
                Número de cuotas
              </label>
              <input
                id="loan-installments"
                inputMode="numeric"
                autoComplete="off"
                placeholder="12"
                value={installments}
                onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} tabular-nums`}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="loan-first-due" className="text-sm font-medium text-neutral-dark">
                Primer vencimiento
              </label>
              <input
                id="loan-first-due"
                type="date"
                value={firstDue}
                onChange={(e) => setFirstDue(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {touched && !canSubmit && (
            <p className="text-xs text-danger-500" role="alert">
              {mode === "payment" && principal > 0 && payment > 0 && installmentsValid
                ? "Con ese capital y ese número de cuotas, la cuota que cargaste no alcanza a cubrir lo prestado: revisa el monto o el plazo."
                : mode === "payment"
                  ? "Completa acreedor, capital, cuota, número de cuotas (1–600) y el primer vencimiento."
                  : "Completa acreedor, capital, tasa (0 o más), cuotas (1–600) y el primer vencimiento."}
            </p>
          )}
        </div>
      </QavanteCard>

      {preview && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Vista previa</span>}>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-neutral-mid">Cuota mensual</dt>
              <dd className="font-semibold tabular-nums text-neutral-dark">
                {formatMoney(preview.monthlyPayment, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">Total a pagar</dt>
              <dd className="font-medium tabular-nums text-neutral-dark">
                {formatMoney(preview.totalToPay, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">
                {mode === "payment" ? "Costo sobre el capital" : "Interés total"}
              </dt>
              <dd className="font-medium tabular-nums text-neutral-dark">
                {formatMoney(preview.totalInterest, currency)}
              </dd>
            </div>
            {mode === "payment" && derivedRate !== null && (
              <div>
                <dt className="text-xs text-neutral-mid">Tasa efectiva</dt>
                <dd className="font-medium tabular-nums text-neutral-dark">
                  {formatPct(derivedRate * 100)} al mes
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-neutral-mid">
            {mode === "payment"
              ? "La tasa efectiva es la que explica tu cuota: lleva dentro los gastos del crédito. El calendario definitivo lo calcula Qavante al registrar."
              : "Estimación referencial. El calendario definitivo lo calcula Qavante al registrar."}
          </p>
          {currency !== "CLP" && (
            <p className="mt-1 text-xs text-neutral-mid">
              El calendario queda en {currency}. La conciliación automática compara la moneda de la
              cuota con la del movimiento, así que las cuotas en {currency} no se van a calzar solas
              contra los débitos en pesos de tu banco: vas a tener que marcarlas tú.
            </p>
          )}
        </QavanteCard>
      )}

      {create.isError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            {create.error instanceof ApiError
              ? apiErrorToUserMessage(create.error)
              : "No pudimos registrar el crédito. Verifica los datos e intenta de nuevo."}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <QavanteButton type="submit" loading={create.isPending} disabled={!canSubmit}>
          Registrar crédito
        </QavanteButton>
      </div>
    </form>
  );
}
