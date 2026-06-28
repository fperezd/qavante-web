"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useCreateLoan } from "@/lib/api/obligations";
import { formatClp } from "@/lib/formatters/clp";
import { loanPreview } from "./loan-amortization";

/* Alta de préstamo. El usuario carga capital, tasa MENSUAL (%), cuotas y primer
   vencimiento; el backend deriva el calendario (amortización francesa). Mostramos
   un preview de la cuota antes de enviar. Al crear, vamos al detalle. Montos CLP;
   fechas con input nativo (valor YYYY-MM-DD para el backend, display DD-MM-AAAA
   en navegador chileno). Gated por `obligations`. */

const inputClass =
  "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function CreateLoanForm() {
  const router = useRouter();
  const create = useCreateLoan();

  const [counterparty, setCounterparty] = React.useState("");
  const [principalRaw, setPrincipalRaw] = React.useState("");
  const [ratePct, setRatePct] = React.useState("");
  const [installments, setInstallments] = React.useState("");
  const [firstDue, setFirstDue] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const principal = Number(principalRaw.replace(/\D/g, ""));
  const monthlyRate = ratePct.trim() === "" ? NaN : Number(ratePct) / 100;
  const n = Number(installments);

  const counterpartyValid = counterparty.trim().length >= 1;
  const principalValid = principal > 0;
  const rateValid = Number.isFinite(monthlyRate) && monthlyRate >= 0;
  const installmentsValid = Number.isInteger(n) && n >= 1 && n <= 600;
  const dueValid = /^\d{4}-\d{2}-\d{2}$/.test(firstDue);
  const canSubmit =
    counterpartyValid && principalValid && rateValid && installmentsValid && dueValid;

  const preview =
    rateValid && principalValid && installmentsValid
      ? loanPreview(principal, monthlyRate, n)
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    create.mutate(
      {
        counterparty: counterparty.trim(),
        principal: String(principal),
        // `toFixed` evita notación científica (ej. 5e-7) y el ruido de float
        // (ej. 0.0289999…998) en este campo decimal de dinero. El backend
        // (Decimal) parsea ceros finales sin problema.
        monthly_rate: monthlyRate.toFixed(8),
        installments: n,
        first_due_date: firstDue,
        currency_code: "CLP",
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
              placeholder="Banco BICE"
              value={counterparty}
              onValueChange={setCounterparty}
              invalid={touched && !counterpartyValid}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="loan-principal" className="text-sm font-medium text-neutral-dark">
                Capital (CLP)
              </label>
              <input
                id="loan-principal"
                inputMode="numeric"
                autoComplete="off"
                placeholder="12.000.000"
                value={principalRaw.replace(/\D/g, "")}
                onChange={(e) => setPrincipalRaw(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </div>

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
              Completa acreedor, capital, tasa (0 o más), cuotas (1–600) y el primer vencimiento.
            </p>
          )}
        </div>
      </QavanteCard>

      {preview && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Vista previa</span>}>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs text-neutral-mid">Cuota mensual</dt>
              <dd className="font-semibold tabular-nums text-neutral-dark">
                {formatClp(preview.monthlyPayment)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">Total a pagar</dt>
              <dd className="font-medium tabular-nums text-neutral-dark">
                {formatClp(preview.totalToPay)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">Interés total</dt>
              <dd className="font-medium tabular-nums text-neutral-dark">
                {formatClp(preview.totalInterest)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-neutral-mid">
            Estimación referencial. El calendario definitivo lo calcula Qavante al registrar.
          </p>
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
              : "No pudimos registrar el préstamo. Verifica los datos e intenta de nuevo."}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <QavanteButton type="submit" loading={create.isPending} disabled={!canSubmit}>
          Registrar préstamo
        </QavanteButton>
      </div>
    </form>
  );
}
