"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useApplyIndustryTemplate,
  type ApplyTemplateResponse,
  type ApplyTemplateSummary,
} from "@/lib/api/industry-templates";

/* Dialog confirmatorio de "Aplicar plantilla" — Addendum §14.1 (NUNCA
   destructivo). Modo único expuesto: `add_missing` (crea dims faltantes;
   cuentas siempre report-only por §6.2). `replace_visibility` queda
   fuera de scope de este PR — es más invasivo (toca dims existentes) y
   amerita su propia decisión de UX, no se cuela acá.

   El dialog muestra el summary del preview (accounts_to_add /
   dimensions_to_add) y exige confirmación explícita por checkbox antes
   de habilitar el botón primario. Tras éxito, devolvemos el response al
   caller via `onApplied` para que actualice la card (esconde el preview,
   muestra "Aplicada"). El hook ya invalida `["management"]` (accounts
   tree + dimensions) al éxito si mode !== suggest_only. */

export interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateCode: string;
  templateName: string;
  /** Summary obtenido del preview (`mode=suggest_only`). Las cuentas/dims
   *  que vamos a agregar son las mismas de la preview. */
  summary: ApplyTemplateSummary;
  /** Callback opcional al éxito; el caller suele esconder el preview. */
  onApplied?: (response: ApplyTemplateResponse) => void;
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  templateCode,
  templateName,
  summary,
  onApplied,
}: ApplyTemplateDialogProps) {
  const apply = useApplyIndustryTemplate();
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  /* Reset al abrir/cerrar: el checkbox no debe quedar marcado entre
     aperturas distintas (cada apply es una decisión explícita). */
  React.useEffect(() => {
    if (open) {
      setConfirmed(false);
      setSubmitError(null);
    }
  }, [open]);

  async function onSubmit() {
    setSubmitError(null);
    try {
      const response = await apply.mutateAsync({
        templateCode,
        body: { mode: "add_missing", overwrite_existing: false },
      });
      onApplied?.(response);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(apiErrorToUserMessage(err));
      } else {
        setSubmitError("Error inesperado. Reintentá.");
      }
    }
  }

  const nothingToDo = summary.accounts_to_add === 0 && summary.dimensions_to_add === 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Aplicar plantilla {templateName}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Qavante va a <strong>agregar</strong> lo que falte. Nunca borra ni pisa lo que ya tenés
            — si algo existe igual, se queda como está.
          </Dialog.Description>

          {nothingToDo ? (
            <div className="space-y-3">
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-success-500/40 bg-success-500/10 p-3 text-sm text-neutral-dark"
              >
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600"
                  aria-hidden="true"
                />
                <p>
                  Tu empresa ya tiene todas las cuentas y vistas de gestión que sugiere esta
                  plantilla. No hay nada para agregar.
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
                  Cerrar
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <>
              <dl className="mb-4 space-y-1 rounded-md border border-neutral-light bg-neutral-light/20 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-mid">Cuentas de gestión nuevas</dt>
                  <dd className="font-semibold text-neutral-dark">{summary.accounts_to_add}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-mid">Vistas de gestión nuevas</dt>
                  <dd className="font-semibold text-neutral-dark">{summary.dimensions_to_add}</dd>
                </div>
                {(summary.accounts_existing > 0 || summary.dimensions_existing > 0) && (
                  <p className="pt-1 text-xs text-neutral-mid">
                    {summary.accounts_existing} cuentas y {summary.dimensions_existing} vistas ya
                    existen — se respetan sin cambios.
                  </p>
                )}
              </dl>

              <label className="mb-4 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  aria-required="true"
                  className="mt-0.5 h-4 w-4 rounded border-neutral-light text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-neutral-dark">
                  Entiendo que esto va a agregar las cuentas y vistas listadas arriba a mi empresa.
                </span>
              </label>

              {submitError && (
                <div
                  role="alert"
                  className="mb-3 rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
                >
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
                  Cancelar
                </Dialog.Close>
                <QavanteButton
                  type="button"
                  onClick={onSubmit}
                  disabled={!confirmed || apply.isPending}
                  loading={apply.isPending}
                >
                  Aplicar plantilla
                </QavanteButton>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
