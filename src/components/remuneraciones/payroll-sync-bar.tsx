"use client";

import * as React from "react";
import { CalendarClock, ArrowRightToLine, CheckCircle2, Pencil } from "lucide-react";
import { QavanteButton, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";

/* Barra de sincronización de planilla → Pagar (ADR-0056). Presentacional: recibe
   el día de pago + handlers por prop. "Registrar en Pagar" dispara el sync que
   persiste el líquido total del período como obligación "Remuneraciones" en Pagar
   (con vencimiento = día de pago). El día de pago lo puede cambiar owner/admin. */

export interface PayrollSyncBarProps {
  /** Regla vigente legible (ej. "último día hábil" / "día 5"). */
  paydayRule?: string | null;
  /** Día del mes (1-31) o null = último día hábil. */
  paydayDay?: number | null;
  /** Líquido total del período (para la confirmación previa). */
  totalLiquido?: number;
  /** Etiqueta del período (ej. "Junio 2026") para la confirmación. */
  periodLabel?: string;
  onSync: () => void;
  syncing?: boolean;
  /** Resultado del último sync (para el mensaje de confirmación). */
  syncResult?: { total_liquido?: number } | null;
  syncError?: unknown;
  onSavePayday?: (day: number | null) => void;
  savingPayday?: boolean;
  paydayError?: unknown;
}

export function PayrollSyncBar({
  paydayRule,
  paydayDay,
  totalLiquido,
  periodLabel,
  onSync,
  syncing = false,
  syncResult = null,
  syncError = null,
  onSavePayday,
  savingPayday = false,
  paydayError = null,
}: PayrollSyncBarProps) {
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [dayInput, setDayInput] = React.useState<string>(paydayDay != null ? String(paydayDay) : "");

  function confirmSync() {
    setConfirming(false);
    onSync();
  }

  function save() {
    const raw = dayInput.trim();
    const day = raw === "" ? null : Number(raw);
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return;
    onSavePayday?.(day);
    setEditing(false);
  }

  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-neutral-dark">
          <CalendarClock className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
          {editing && onSavePayday ? (
            <span className="flex items-center gap-2">
              <label htmlFor="payday-day" className="text-neutral-mid">
                Día de pago
              </label>
              <input
                id="payday-day"
                type="number"
                min={1}
                max={31}
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                placeholder="1-31"
                className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
              <QavanteButton size="sm" onClick={save} loading={savingPayday}>
                Guardar
              </QavanteButton>
              <QavanteButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDayInput("");
                  onSavePayday(null);
                  setEditing(false);
                }}
                disabled={savingPayday}
              >
                Último día hábil
              </QavanteButton>
              <QavanteButton size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </QavanteButton>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Día de pago:{" "}
              <span className="font-medium">{paydayRule ?? "último día hábil"}</span>
              {onSavePayday && (
                <button
                  type="button"
                  onClick={() => {
                    setDayInput(paydayDay != null ? String(paydayDay) : "");
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-0.5 text-xs text-brand-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  cambiar
                </button>
              )}
            </span>
          )}
        </div>

        <QavanteButton onClick={() => setConfirming(true)} loading={syncing}>
          <ArrowRightToLine className="h-4 w-4" aria-hidden="true" />
          Registrar en Pagar
        </QavanteButton>
      </div>

      {confirming && (
        <ConfirmSyncDialog
          periodLabel={periodLabel}
          totalLiquido={totalLiquido}
          paydayRule={paydayRule}
          onConfirm={confirmSync}
          onCancel={() => setConfirming(false)}
        />
      )}

      {syncResult && !syncError && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Planilla registrada en Pagar como obligación <strong>Remuneraciones</strong>
            {typeof syncResult.total_liquido === "number" && (
              <> por {formatClp(syncResult.total_liquido)}</>
            )}{" "}
            (vence el {paydayRule ?? "último día hábil"}). La verás en la caja de Pagar junto a tus
            otras cuentas por pagar.
          </span>
        </p>
      )}
      {syncError != null && (
        <div className="mt-3">
          <QavanteInlineError error={syncError} what="la sincronización de la planilla" />
        </div>
      )}
      {paydayError != null && (
        <div className="mt-3">
          <QavanteInlineError error={paydayError} what="el día de pago" />
        </div>
      )}
    </QavanteCard>
  );
}

/* Confirmación previa al registro. Aclara que si la planilla ya está registrada
   se ACTUALIZA (el backend es idempotente por período) — no se duplica. */
function ConfirmSyncDialog({
  periodLabel,
  totalLiquido,
  paydayRule,
  onConfirm,
  onCancel,
}: {
  periodLabel?: string;
  totalLiquido?: number;
  paydayRule?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar registro en Pagar"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-dark">Registrar planilla en Pagar</h2>
          <p className="mt-2 text-sm text-neutral-mid">
            Vas a registrar la planilla{periodLabel ? <> de <strong>{periodLabel}</strong></> : null}{" "}
            en Pagar como obligación{" "}
            {typeof totalLiquido === "number" && (
              <>
                por <strong>{formatClp(totalLiquido)}</strong>
              </>
            )}{" "}
            (vence el {paydayRule ?? "último día hábil"}).
          </p>
          <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-neutral-mid">
            Si esta planilla <strong>ya está registrada</strong>, se actualiza con el monto vigente —
            no se crea una obligación duplicada.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <QavanteButton variant="ghost" onClick={onCancel}>
            Cancelar
          </QavanteButton>
          <QavanteButton onClick={onConfirm}>Registrar</QavanteButton>
        </div>
      </div>
    </div>
  );
}
