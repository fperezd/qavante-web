"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ReplaceClassificationRequest } from "@/lib/api/treasury";
import { useAccountClassificationDimensions } from "@/lib/api/treasury";

export interface ClassificationAccountOption {
  id: string;
  label: string;
}

export interface ClassificationEventOption {
  code: string;
  label: string;
}

export interface ClassificationDimensionOption {
  id: string;
  name: string;
  values: Array<{ id: string; name: string }>;
}

interface EditorLine {
  id: string;
  accountId: string;
  kind: "amount" | "percentage";
  value: string;
  dimensions: Record<string, string>;
}

export function DistributedClassificationEditor({
  totalAmount,
  currency,
  accounts,
  events,
  dimensions,
  saving,
  onCancel,
  onSave,
}: {
  totalAmount: number;
  currency: string;
  accounts: ClassificationAccountOption[];
  events: ClassificationEventOption[];
  dimensions: ClassificationDimensionOption[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (body: ReplaceClassificationRequest) => Promise<void>;
}) {
  const [mode, setMode] = React.useState<"amount" | "percentage" | "hybrid">("percentage");
  const [eventType, setEventType] = React.useState(events[0]?.code ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [missingByLine, setMissingByLine] = React.useState<Record<string, boolean>>({});
  const [lines, setLines] = React.useState<EditorLine[]>(() => [newLine(accounts[0]?.id)]);

  React.useEffect(() => {
    if (!eventType && events[0]?.code) setEventType(events[0].code);
  }, [eventType, events]);

  function changeMode(next: "amount" | "percentage" | "hybrid") {
    setMode(next);
    setLines((current) =>
      current.map((line) => ({
        ...line,
        kind: next === "amount" ? "amount" : "percentage",
        value: "",
      })),
    );
    setError(null);
  }

  function submit() {
    const values = lines.map((line) => parseNumber(line.value));
    if (!eventType || lines.some((line) => !line.accountId) || values.some((value) => value <= 0)) {
      setError("Completa el tipo, la cuenta y un valor mayor que cero en cada línea.");
      return;
    }
    if (Object.values(missingByLine).some(Boolean)) {
      setError("Completa las dimensiones obligatorias de cada cuenta.");
      return;
    }
    const amountSum = lines.reduce(
      (sum, line, index) => sum + (line.kind === "amount" ? values[index]! : 0),
      0,
    );
    const percentageSum = lines.reduce(
      (sum, line, index) => sum + (line.kind === "percentage" ? values[index]! : 0),
      0,
    );
    if (mode === "amount" && !sameMoney(amountSum, totalAmount)) {
      setError(`Los montos deben sumar exactamente ${formatMoney(totalAmount, currency)}.`);
      return;
    }
    if (mode !== "amount" && !samePercentage(percentageSum, 100)) {
      setError("Los porcentajes deben sumar exactamente 100%.");
      return;
    }
    if (mode === "hybrid" && amountSum >= totalAmount) {
      setError("En modo mixto, los montos fijos deben dejar un saldo para distribuir.");
      return;
    }
    void onSave({
      mode,
      financial_event_type: eventType as ReplaceClassificationRequest["financial_event_type"],
      allocations: lines.map((line, index) => ({
        management_account_id: line.accountId,
        ...(line.kind === "amount"
          ? { amount: String(values[index]) }
          : { percentage: String(values[index]) }),
        dimensions: Object.entries(line.dimensions)
          .filter(([, valueId]) => Boolean(valueId))
          .map(([dimensionId, dimensionValueId]) => ({
            dimension_id: dimensionId,
            dimension_value_id: dimensionValueId,
          })),
      })),
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-light bg-neutral-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-neutral-mid">
          Tipo financiero
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            className={fieldClass}
          >
            {events.map((event) => (
              <option key={event.code} value={event.code}>
                {event.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-neutral-mid">
          Distribuir por
          <select
            value={mode}
            onChange={(event) => changeMode(event.target.value as typeof mode)}
            className={fieldClass}
          >
            <option value="percentage">Porcentaje</option>
            <option value="amount">Monto</option>
            <option value="hybrid">Monto + porcentaje</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-neutral-mid">
        Total a distribuir: <strong>{formatMoney(totalAmount, currency)}</strong>. El monto guardado
        es la verdad; Qavante resuelve los residuos de redondeo.
      </p>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <AllocationEditorLine
            key={line.id}
            line={line}
            index={index}
            mode={mode}
            accounts={accounts}
            dimensions={dimensions}
            canRemove={lines.length > 1}
            onMissingChange={(missing) =>
              setMissingByLine((current) => ({ ...current, [line.id]: missing }))
            }
            onChange={(next) =>
              setLines((current) => current.map((item) => (item.id === line.id ? next : item)))
            }
            onRemove={() => setLines((current) => current.filter((item) => item.id !== line.id))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLines((current) => [...current, newLine(accounts[0]?.id)])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary"
      >
        <Plus className="size-4" aria-hidden /> Agregar distribución
      </button>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-mid"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar clasificación"}
        </button>
      </div>
    </div>
  );
}

function AllocationEditorLine({
  line,
  index,
  mode,
  accounts,
  dimensions,
  canRemove,
  onChange,
  onRemove,
  onMissingChange,
}: {
  line: EditorLine;
  index: number;
  mode: "amount" | "percentage" | "hybrid";
  accounts: ClassificationAccountOption[];
  dimensions: ClassificationDimensionOption[];
  canRemove: boolean;
  onChange: (line: EditorLine) => void;
  onRemove: () => void;
  onMissingChange: (missing: boolean) => void;
}) {
  const policies = useAccountClassificationDimensions(line.accountId);
  const enabled = (policies.data?.items ?? []).filter((policy) => policy.is_enabled);
  const visibleDimensions = enabled
    .map((policy) => ({
      policy,
      catalog: dimensions.find((dimension) => dimension.id === policy.dimension_id),
    }))
    .filter((item) => item.catalog != null);
  const missingRequired = visibleDimensions.some(
    ({ policy }) => policy.is_required && !line.dimensions[policy.dimension_id],
  );
  const missingCallback = React.useRef(onMissingChange);
  React.useEffect(() => {
    missingCallback.current = onMissingChange;
  }, [onMissingChange]);
  React.useEffect(() => missingCallback.current(missingRequired), [missingRequired]);

  return (
    <fieldset className="space-y-3 rounded-lg border border-neutral-light bg-surface p-3">
      <legend className="px-1 text-xs font-semibold text-neutral-mid">Destino {index + 1}</legend>
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <select
          aria-label={`Cuenta de gestión destino ${index + 1}`}
          value={line.accountId}
          onChange={(event) => onChange({ ...line, accountId: event.target.value, dimensions: {} })}
          className={fieldClass}
        >
          <option value="">Selecciona una cuenta</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
        <div className="flex">
          {mode === "hybrid" && (
            <select
              aria-label={`Tipo de valor ${index + 1}`}
              value={line.kind}
              onChange={(event) =>
                onChange({ ...line, kind: event.target.value as EditorLine["kind"], value: "" })
              }
              className={`${fieldClass} rounded-r-none`}
            >
              <option value="amount">$</option>
              <option value="percentage">%</option>
            </select>
          )}
          <input
            aria-label={`${line.kind === "amount" ? "Monto" : "Porcentaje"} destino ${index + 1}`}
            inputMode="decimal"
            value={line.value}
            onChange={(event) => onChange({ ...line, value: event.target.value })}
            placeholder={line.kind === "amount" ? "Monto" : "%"}
            className={`${fieldClass} ${mode === "hybrid" ? "rounded-l-none" : ""}`}
          />
        </div>
        <button
          type="button"
          aria-label={`Eliminar destino ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="rounded-md p-2 text-neutral-mid disabled:opacity-30"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {visibleDimensions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleDimensions.map(({ policy, catalog }) => (
            <label key={policy.dimension_id} className="text-xs font-semibold text-neutral-mid">
              {catalog!.name}
              {policy.is_required ? " *" : ""}
              <select
                value={line.dimensions[policy.dimension_id] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...line,
                    dimensions: { ...line.dimensions, [policy.dimension_id]: event.target.value },
                  })
                }
                className={fieldClass}
              >
                <option value="">
                  {policy.is_required ? "Selecciona un valor" : "Sin asignar"}
                </option>
                {catalog!.values.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

const fieldClass =
  "mt-1 w-full rounded-lg border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none";

function newLine(accountId = ""): EditorLine {
  return { id: crypto.randomUUID(), accountId, kind: "percentage", value: "", dimensions: {} };
}

function parseNumber(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameMoney(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.00001;
}

function samePercentage(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.00000001;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(value);
}
