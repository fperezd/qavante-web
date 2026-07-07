"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Eye, Download } from "lucide-react";

/* Acciones de un DTE en una fila:
   - Ver: al pasar el mouse (o enfocar) sobre el ícono, muestra una VISTA PREVIA
     del PDF en un popover (iframe), con delay de apertura y una gracia al cerrar
     para poder mover el cursor hacia el popover sin que se cierre. Portal +
     posición `fixed`; se cierra al scrollear/resize (la posición no se recalcula).
   - Descargar: link `download` con `target="_blank"` (el PDF es cross-origin →
     el atributo `download` no fuerza la descarga, así que abrimos en pestaña nueva
     para NO sacar al usuario de la app).
   Ambos apuntan al PDF del SII (GET directo del browser con cookies httpOnly).
   Sin URL → guion. */

const iconCls =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function DteActions({
  url,
  label,
  preview = true,
}: {
  url: string | null;
  label?: string;
  /** Muestra la vista previa al hover. `false` = solo descargar (para los
   *  endpoints cuyo PDF aún NO permite framing cross-origin → el iframe daría
   *  "rechazó la conexión"; hoy dte-recibidos/emitidos, ver STATE_OF_THE_TRAIN).
   *  Cuando CC-API agregue `frame-ancestors` a esos PDFs, volver a `true`. */
  preview?: boolean;
}) {
  if (!url) return <span className="text-xs text-neutral-light">—</span>;
  const suffix = label ? ` ${label}` : "";
  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {preview && <DtePreview url={url} suffix={suffix} />}
      <a
        href={url}
        download
        target="_blank"
        rel="noreferrer"
        title="Descargar DTE"
        aria-label={`Descargar DTE${suffix}`}
        className={iconCls}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </span>
  );
}

const OPEN_DELAY = 280;
const CLOSE_GRACE = 180;
/* Tamaño objetivo del preview — grande y legible (aspecto ~carta), acotado al
   viewport. El UX manda: un DTE tiene que poder LEERSE en el preview. */
const MAX_W = 720;
const VH_RATIO = 0.86;

interface Pos {
  top: number;
  left: number;
  width: number;
  height: number;
}

function DtePreview({ url, suffix }: { url: string; suffix: string }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(MAX_W, vw - 24);
    const height = Math.min(Math.round(vh * VH_RATIO), vh - 24);
    // A la izquierda del ícono (van al borde derecho de la tabla), clampeado.
    const left = Math.max(12, Math.min(r.right - width, vw - width - 12));
    const top = Math.max(12, Math.min(r.bottom + 6, vh - height - 12));
    setPos({ top, left, width, height });
  }

  function openSoon() {
    clearTimers();
    openTimer.current = setTimeout(() => {
      place();
      setOpen(true);
    }, OPEN_DELAY);
  }
  /* Cierre con gracia: da tiempo a cruzar el gap hacia el popover (su onMouseEnter
     cancela el cierre). */
  function closeSoon() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_GRACE);
  }

  React.useEffect(() => clearTimers, []);

  /* La posición es `fixed` y no se recalcula: al scrollear/resize la cerramos
     para que no quede flotando desprendida del ícono. */
  React.useEffect(() => {
    if (!open) return undefined;
    const onMove = () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setOpen(false);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={closeSoon}
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
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
            onMouseEnter={clearTimers}
            onMouseLeave={closeSoon}
          >
            <iframe src={url} title={`Vista previa del DTE${suffix}`} className="h-full w-full" />
          </div>,
          document.body,
        )}
    </>
  );
}
