import * as React from "react";
import { cn } from "@/lib/utils";

/* Etiquetas que identifican fuente de datos. Anexo B.6 fila 20. Fuentes
   alineadas con conectores wireados en backend: SII (RCV, DTE, BHE),
   BICE (bancos), Buk (nómina), TGR (tesorería), Previred. */

export type QavanteSource =
  | "sii"
  | "sii-rcv"
  | "sii-dte"
  | "sii-bhe"
  | "bice"
  | "buk"
  | "tgr"
  | "previred"
  | "manual";

const sourceMeta: Record<QavanteSource, { label: string; className: string }> = {
  sii: { label: "SII", className: "bg-brand-primary-50 text-brand-primary-700" },
  "sii-rcv": { label: "SII · RCV", className: "bg-brand-primary-50 text-brand-primary-700" },
  "sii-dte": { label: "SII · DTE", className: "bg-brand-primary-50 text-brand-primary-700" },
  "sii-bhe": { label: "SII · BHE", className: "bg-brand-primary-50 text-brand-primary-700" },
  bice: { label: "BICE", className: "bg-info-500/15 text-info-500" },
  buk: { label: "Buk", className: "bg-success-500/15 text-success-500" },
  tgr: { label: "TGR", className: "bg-warning-500/15 text-warning-500" },
  previred: { label: "Previred", className: "bg-warning-500/15 text-warning-500" },
  manual: { label: "Manual", className: "bg-neutral-light/40 text-neutral-mid" },
};

export interface QavanteSourceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  source: QavanteSource;
}

export function QavanteSourceTag({ source, className, ...props }: QavanteSourceTagProps) {
  const meta = sourceMeta[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-current/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        meta.className,
        className,
      )}
      {...props}
    >
      {meta.label}
    </span>
  );
}
