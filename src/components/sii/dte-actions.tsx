"use client";

import { FileText, Download } from "lucide-react";

/* Acciones de un DTE en una fila: Ver (abre el PDF en una pestaña nueva) y
   Descargar. Ambos apuntan a la misma URL de PDF del SII (GET directo del browser
   con las cookies httpOnly, mismo origen vía proxy — patrón `siiF29PdfUrl`). Si no
   hay URL (faltan datos o base), muestra un guion. El comportamiento final
   (inline vs adjunto) lo define el `Content-Disposition` del backend. */

export function DteActions({ url, label }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-xs text-neutral-light">—</span>;
  const suffix = label ? ` ${label}` : "";
  const cls =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";
  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Ver DTE"
        aria-label={`Ver DTE${suffix}`}
        className={cls}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={url}
        download
        title="Descargar DTE"
        aria-label={`Descargar DTE${suffix}`}
        className={cls}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </span>
  );
}
