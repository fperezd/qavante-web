"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import {
  useSelectFinancialDecisionAlternative,
  type DecisionSelectionResponse,
} from "@/lib/api/financial-decisions";
import { selectionErrorMessage } from "./liquidity-selection-model";

interface LiquiditySelectionDialogProps {
  decisionId: string;
  alternativeId: string;
  alternativeTitle: string;
  isNoAction: boolean;
  onSelected: (result: DecisionSelectionResponse) => void;
}

interface SelectionIntent {
  fingerprint: string;
  idempotencyKey: string;
}

export function LiquiditySelectionDialog({
  decisionId,
  alternativeId,
  alternativeTitle,
  isNoAction,
  onSelected,
}: LiquiditySelectionDialogProps) {
  const selection = useSelectFinancialDecisionAlternative(decisionId);
  const [open, setOpen] = React.useState(false);
  const [rationale, setRationale] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const intent = React.useRef<SelectionIntent | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && !selection.isPending) {
      setRationale("");
      setError(null);
      intent.current = null;
      selection.reset();
    }
  }

  async function submit() {
    const normalizedRationale = rationale.trim();
    if (!normalizedRationale) {
      setError("Explica brevemente por qué eliges esta alternativa.");
      return;
    }

    const fingerprint = `${alternativeId}\u0000${normalizedRationale}`;
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setError(null);
    try {
      const result = await selection.mutateAsync({
        alternative_id: alternativeId,
        idempotency_key: intent.current.idempotencyKey,
        rationale: normalizedRationale,
      });
      onSelected(result);
      setOpen(false);
    } catch (cause) {
      setError(selectionErrorMessage(cause));
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        aria-label={`Elegir ${alternativeTitle}`}
        render={<QavanteButton type="button" variant="secondary" size="sm" />}
      >
        Elegir alternativa
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup
          data-selection-dialog={alternativeId}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-surface p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Elegir {alternativeTitle}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {isNoAction
              ? "Registrarás la decisión de no financiar. No se creará un plan operativo."
              : "Registrarás tu elección y Qavante preparará un plan operativo en borrador. Esto no solicita ni ejecuta financiamiento."}
          </Dialog.Description>

          <label
            htmlFor={`selection-rationale-${alternativeId}`}
            className="text-sm font-semibold text-neutral-dark"
          >
            Motivo de tu decisión
          </label>
          <textarea
            id={`selection-rationale-${alternativeId}`}
            value={rationale}
            maxLength={2000}
            rows={4}
            disabled={selection.isPending}
            onChange={(event) => {
              setRationale(event.target.value);
              setError(null);
              intent.current = null;
            }}
            placeholder="Ej.: protege la caja del próximo vencimiento con el menor costo verificable."
            className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-neutral-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-neutral-mid">{rationale.length}/2000</p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-warning-500/40 bg-warning-50 p-3 text-sm text-warning-700"
            >
              {error}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
              Cancelar
            </Dialog.Close>
            <QavanteButton type="button" loading={selection.isPending} onClick={submit}>
              Confirmar selección
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
