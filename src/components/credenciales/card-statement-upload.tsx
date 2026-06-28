"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, FileUp, Upload } from "lucide-react";
import { QavanteCard, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useImportCardStatement } from "@/lib/api/card-statements";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/* Subir cartola de tarjeta (PDF BICE). Importa compras (incl. al extranjero),
   pago detectado y cargos. Alternativa/complemento al sync automático. Montos:
   USD se muestra crudo (string), CLP con formatClp; fechas DD-MM-AAAA. */

const MAX_MB = 15;

export function CardStatementUpload() {
  const importCartola = useImportCardStatement();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  function pick(f: File | null) {
    setLocalError(null);
    importCartola.reset();
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setLocalError("La cartola debe ser un archivo PDF.");
      setFile(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setLocalError(`El archivo supera los ${MAX_MB} MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function submit() {
    if (!file) return;
    importCartola.mutate(file, {
      onSuccess: () => {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      },
    });
  }

  const res = importCartola.data;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Subir cartola</span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid">
          Sube el PDF de tu cartola BICE (nacional o internacional) para registrar tus compras,
          incluidas las del extranjero. Lo procesamos y lo ves en Caja.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block max-w-full text-sm text-neutral-dark file:mr-3 file:rounded-md file:border-0 file:bg-brand-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-primary hover:file:bg-brand-primary-50/70"
          />
          <QavanteButton
            size="sm"
            loading={importCartola.isPending}
            disabled={!file}
            onClick={submit}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Subir cartola
          </QavanteButton>
        </div>

        {localError && (
          <p className="text-xs text-danger-500" role="alert">
            {localError}
          </p>
        )}

        {importCartola.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 p-2.5 text-sm text-danger-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {importCartola.error instanceof ApiError
                ? apiErrorToUserMessage(importCartola.error)
                : "No pudimos procesar la cartola. Verifica que sea el PDF de BICE e intenta de nuevo."}
            </p>
          </div>
        )}

        {res && (
          <div className="space-y-2 rounded-lg border border-success-500/40 bg-success-500/10 p-3 text-sm text-success-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p className="font-medium">Cartola importada.</p>
            </div>
            <ul className="ml-6 list-disc space-y-0.5 text-neutral-dark">
              {typeof res.purchases_upserted === "number" && (
                <li>
                  {res.purchases_upserted}{" "}
                  {res.purchases_upserted === 1 ? "compra registrada" : "compras registradas"}
                </li>
              )}
              {res.needs_review > 0 && <li>{res.needs_review} por revisar</li>}
              {res.deuda_total_usd && <li>Deuda total: USD {res.deuda_total_usd}</li>}
              {typeof res.charges_detected === "number" && res.charges_detected > 0 && (
                <li>{res.charges_detected} cargos detectados</li>
              )}
              {res.payment_detected && (
                <li>Pago detectado: {formatClp(Number(res.payment_detected))}</li>
              )}
              {res.pagar_hasta && <li>Pagar hasta: {formatDateLike(res.pagar_hasta)}</li>}
            </ul>
          </div>
        )}
      </div>
    </QavanteCard>
  );
}
