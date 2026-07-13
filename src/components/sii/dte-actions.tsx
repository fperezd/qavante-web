"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Eye, Download, FileWarning, Loader2, KeyRound } from "lucide-react";
import { classifyDtePreviewError, type DtePreviewError } from "./dte-preview-error";

/* Acciones de un DTE en una fila:
   - Ver: al pasar el mouse (o enfocar) sobre el ícono, muestra una VISTA PREVIA
     del PDF en un popover (iframe), con delay de apertura y una gracia al cerrar
     para poder mover el cursor hacia el popover sin que se cierre. Portal +
     posición `fixed`; se cierra al scrollear/resize (la posición no se recalcula).
   - Descargar: link `download` con `target="_blank"` (el PDF es cross-origin →
     el atributo `download` no fuerza la descarga, así que abrimos en pestaña nueva
     para NO sacar al usuario de la app).
   Ambos apuntan al PDF del SII (GET directo del browser con cookies httpOnly).
   Sin URL → guion.

   El preview NO puede framear la URL directa: el backend responde con
   `X-Frame-Options: DENY` (header de seguridad global) → el navegador bloquea el
   embed en iframe/object. Como el backend SÍ tiene CORS credencializado para
   `app.qavante.com`, el FE hace `fetch(url, {credentials})` → arma un `blob:` URL
   (same-origin, al que X-Frame-Options NO aplica) → framea ESO. Así el PDF vuelve
   a verse sin depender del header del backend. Si la respuesta no es PDF (o falla),
   cae a un FALLBACK honesto (mensaje + descarga). La causa raíz (X-Frame-Options en
   los endpoints de PDF) está escalada a CC-API para arreglarla de fondo. */

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
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [cause, setCause] = React.useState<DtePreviewError>({ kind: "generic" });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Trae el PDF por fetch (credenciales) y lo sirve como blob same-origin, para
     evadir el X-Frame-Options: DENY del backend. Solo cuando el popover abre. */
  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let created: string | null = null;
    setState("loading");
    setBlobUrl(null);
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        // Un error servido con 200 suele venir como HTML/JSON → no es un PDF. Se lee
        // el cuerpo para dar un surface HONESTO: si es sesión/certificado SII caído
        // (el SII devuelve login, o el listado trae 0 docs) → CTA a Credenciales; si
        // no, se muestra el motivo del backend. No se oculta el fallo.
        if (!res.ok || ct.includes("html") || ct.includes("json")) {
          const body = await res.text().catch(() => "");
          if (!cancelled) {
            setCause(classifyDtePreviewError(res.status, ct, body));
            setState("error");
          }
          return;
        }
        const data = await res.blob();
        created = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        setBlobUrl(created);
        setState("ready");
      })
      .catch(() => {
        // Fallo de red / fetch abortado: sin cuerpo que clasificar → genérico.
        if (!cancelled) {
          setCause({ kind: "generic" });
          setState("error");
        }
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [open, url]);

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
            {state === "ready" && blobUrl ? (
              <iframe
                src={blobUrl}
                title={`Vista previa del DTE${suffix}`}
                className="h-full w-full"
              />
            ) : state === "loading" ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-mid" aria-hidden="true" />
                <span className="sr-only">Cargando la vista previa…</span>
              </div>
            ) : cause.kind === "sii_session" ? (
              /* Sesión/certificado SII caído: la causa real + la acción concreta
                 (reconectar). NO se ofrece descargar: con la sesión caída también
                 falla. CTA directo a Credenciales. */
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <KeyRound className="h-9 w-9 text-neutral-mid" aria-hidden="true" />
                <p className="text-sm font-medium text-neutral-dark">{cause.title}</p>
                <p className="max-w-[18rem] text-xs leading-relaxed text-neutral-mid">
                  {cause.description}
                </p>
                <Link
                  href="/administracion/credenciales"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-brand-primary-600"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Reconectar el SII
                </Link>
              </div>
            ) : (
              /* Fallback honesto: si vino un motivo del backend, se muestra tal cual;
                 si no, el genérico. En ambos se ofrece descargar. */
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <FileWarning className="h-9 w-9 text-neutral-mid" aria-hidden="true" />
                <p className="text-sm font-medium text-neutral-dark">
                  {cause.kind === "backend" ? cause.title : "No pudimos mostrar la vista previa"}
                </p>
                <p className="max-w-[18rem] text-xs leading-relaxed text-neutral-mid">
                  {cause.kind === "backend"
                    ? cause.description
                    : "No pudimos traer este documento como PDF. Puedes descargarlo e intentar abrirlo."}
                </p>
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-brand-primary-600"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Descargar DTE
                </a>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
