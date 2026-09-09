"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2, X } from "lucide-react";
import { QavanteButton, QavanteInlineError } from "@/components/qavante";
import { useDocumentSuggestions } from "@/lib/api/reconciliation";
import { formatClp, formatClpBare, formatMoney } from "@/lib/formatters/clp";

type Props = {
  movementId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (documentId: string) => void;
  choosing: boolean;
  /** Moneda del movimiento que el backend usa para filtrar los candidatos. */
  currencyCode?: string | null;
};

export function formatDocumentSuggestionAmount(
  amount: string | number,
  currencyCode?: string | null,
): string {
  const value = Number(amount);
  if (currencyCode === "S/D") return `${formatClpBare(value)} · moneda desconocida`;
  return currencyCode ? formatMoney(value, currencyCode) : formatClp(value);
}

/** Elección explícita de documento: muestra candidatos, pero nunca infiere ni ejecuta por sí sola. */
export function DocumentSuggestionsDialog({
  movementId,
  open,
  onOpenChange,
  onChoose,
  choosing,
  currencyCode,
}: Props) {
  const suggestions = useDocumentSuggestions(movementId, open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-neutral-dark">
                Elige el documento correcto
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-neutral-mid">
                Estos son candidatos. Revisa los datos antes de confirmar la conciliación.
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={choosing}
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pt-3">
            {suggestions.isLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-neutral-mid">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando candidatos…
              </div>
            )}
            {suggestions.isError && (
              <QavanteInlineError
                error={suggestions.error}
                what="los documentos candidatos"
                onRetry={() => suggestions.refetch()}
              />
            )}
            {!suggestions.isLoading &&
              !suggestions.isError &&
              suggestions.data?.suggestions.length === 0 && (
                <p className="py-6 text-sm text-neutral-mid">
                  No encontramos otro documento candidato para este movimiento. Puedes descartarlo y
                  revisarlo después.
                </p>
              )}
            <ul className="space-y-2">
              {suggestions.data?.suggestions.map((document) => {
                const title = document.name || "Documento sin contraparte";
                const reference = [
                  document.document_type ? `DTE ${document.document_type}` : document.kind,
                  document.folio ? `Folio ${document.folio}` : null,
                  document.date ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={document.document_id}
                    className="rounded-lg border border-neutral-light p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-dark" title={title}>
                          {title}
                        </p>
                        <p className="text-xs text-neutral-mid">
                          {reference || "Sin referencia disponible"}
                        </p>
                        <p className="mt-1 text-sm tabular-nums text-neutral-dark">
                          {formatDocumentSuggestionAmount(document.amount, currencyCode)}
                        </p>
                      </div>
                      <QavanteButton
                        size="sm"
                        onClick={() => onChoose(document.document_id)}
                        loading={choosing}
                        disabled={choosing}
                        aria-label={`Conciliar con ${title}`}
                      >
                        Elegir
                      </QavanteButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
