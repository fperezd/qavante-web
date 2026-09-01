"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import {
  useRequestOperationPlanApproval,
  type OperationApprovalResponse,
} from "@/lib/api/financial-decisions";
import { operationPlanErrorMessage } from "./operation-plan-model";

export interface OperationPlanApprovalDialogProps {
  operationPlanId: string;
  evidenceRefs: string[];
  onRequested: (response: OperationApprovalResponse) => void;
}

interface ApprovalIntent {
  fingerprint: string;
  idempotencyKey: string;
}

export function OperationPlanApprovalDialog({
  operationPlanId,
  evidenceRefs,
  onRequested,
}: OperationPlanApprovalDialogProps) {
  const request = useRequestOperationPlanApproval(operationPlanId);
  const [open, setOpen] = React.useState(false);
  const [rationale, setRationale] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const intent = React.useRef<ApprovalIntent | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && !request.isPending) {
      setRationale("");
      setError(null);
      intent.current = null;
      request.reset();
    }
  }

  async function submit() {
    const normalized = rationale.trim();
    if (!normalized) {
      setError("Explica brevemente por qué solicitas esta aprobación.");
      return;
    }
    if (evidenceRefs.length === 0) {
      setError("El plan no informa evidencia verificable para solicitar aprobación.");
      return;
    }

    const fingerprint = `${normalized}\u0000${evidenceRefs.join("\u0000")}`;
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setError(null);
    try {
      const response = await request.mutateAsync({
        idempotency_key: intent.current.idempotencyKey,
        evidence_refs: evidenceRefs,
        rationale: normalized,
      });
      onRequested(response);
      setOpen(false);
    } catch (cause) {
      setError(operationPlanErrorMessage(cause, "request_approval"));
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger render={<QavanteButton type="button" size="sm" />}>
        Solicitar aprobación
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup
          data-operation-plan-approval={operationPlanId}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-surface p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Solicitar aprobación del plan
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Enviarás este plan a revisión humana con {evidenceRefs.length} evidencia
            {evidenceRefs.length === 1 ? "" : "s"}. Esto no lo aprueba, envía a un proveedor ni
            mueve dinero.
          </Dialog.Description>

          <label
            htmlFor={`approval-rationale-${operationPlanId}`}
            className="text-sm font-semibold text-neutral-dark"
          >
            Motivo de la solicitud
          </label>
          <textarea
            id={`approval-rationale-${operationPlanId}`}
            value={rationale}
            maxLength={2000}
            rows={4}
            disabled={request.isPending}
            onChange={(event) => {
              setRationale(event.target.value);
              setError(null);
              intent.current = null;
            }}
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
            <QavanteButton type="button" loading={request.isPending} onClick={submit}>
              Confirmar solicitud
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
