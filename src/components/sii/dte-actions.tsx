"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Eye, Download } from "lucide-react";

/* Acciones de un DTE en una fila:
   - Ver: al pasar el mouse (o enfocar) sobre el ícono, muestra una VISTA PREVIA
     del PDF en un popover (iframe). Se abre con un pequeño delay para no cargar en
     hovers accidentales. Usa un portal + posición `fixed` para no quedar recortado
     por el overflow de la tabla.
   - Descargar: link `download` a la misma URL del PDF.
   Ambos apuntan al PDF del SII (GET directo del browser con cookies httpOnly, mismo
   origen vía proxy — patrón `siiF29PdfUrl`). Sin URL → guion. */

const iconCls =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function DteActions({ url, label }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-xs text-neutral-light">—</span>;
  const suffix = label ? ` ${label}` : "";
  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <DtePreview url={url} suffix={suffix} />
      <a
        href={url}
        download
        title="Descargar DTE"
        aria-label={`Descargar DTE${suffix}`}
        className={iconCls}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </span>
  );
}

function DtePreview({ url, suffix }: { url: string; suffix: string }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const W = 320;
  const H = 420;

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // A la izquierda del ícono (van al borde derecho de la tabla); clamp al viewport.
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    const top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - H - 8));
    setPos({ top, left });
  }

  function openSoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      place();
      setOpen(true);
    }, 280);
  }
  function closeNow() {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={openSoon}
        onMouseLeave={closeNow}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={closeNow}
        title="Vista previa del DTE"
        aria-label={`Vista previa del DTE${suffix}`}
        className={iconCls}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-label={`Vista previa del DTE${suffix}`}
            className="fixed z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: W, height: H }}
            onMouseEnter={() => {
              if (timer.current) clearTimeout(timer.current);
            }}
            onMouseLeave={closeNow}
          >
            <iframe src={url} title={`Vista previa del DTE${suffix}`} className="h-full w-full" />
          </div>,
          document.body,
        )}
    </>
  );
}
