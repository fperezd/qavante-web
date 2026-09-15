"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Eye, Download, FileWarning, Loader2, KeyRound, X } from "lucide-react";
import { classifyDtePreviewError, type DtePreviewError } from "./dte-preview-error";

/* Acciones de un DTE en una fila:
   - Ver: abre una VISTA PREVIA del PDF en un popover (iframe). Portal + posición
     `fixed`; se cierra al scrollear/resize (la posición no se recalcula).
   - Descargar: link `download` con `target="_blank"` (el PDF es cross-origin →
     el atributo `download` no fuerza la descarga, así que abrimos en pestaña nueva
     para NO sacar al usuario de la app).
   Ambos apuntan al PDF del SII (GET directo del browser con cookies httpOnly).
   Sin URL → guion.

   El preview trae el PDF por `fetch(url, {credentials})` y framea un `blob:` URL
   (same-origin) en vez de apuntar el iframe a la URL de la API. Si la respuesta no
   es PDF (o falla), cae a un FALLBACK honesto (mensaje + descarga).

   El rodeo NO lo exige hoy el backend: `server.py` exceptúa las respuestas
   `application/pdf` y les manda `Content-Security-Policy: frame-ancestors` acotado a
   los orígenes del front, sin `X-Frame-Options`. Framear la URL directa funcionaría.
   Lo que el fetch sí compra es el ERROR: con `blob:` se puede leer la respuesta y
   clasificarla (`classifyDtePreviewError` mira el código, el content-type y el cuerpo
   —no el `status`— y devuelve `sii_session` con dos copys distintos, `backend` con el
   motivo crudo, o `generic`), y mostrar un fallback en vez de nada. Un `<iframe src>`
   directo dejaría el popover EN BLANCO: la excepción de framing del middleware cubre
   sólo `application/pdf`, así que una respuesta de ERROR cae en el `else` y sale con
   `X-Frame-Options: DENY` — el browser se niega a mostrarla. Simplificarlo perdería
   eso, así que no es sólo grasa.

   Y eso importa para la accesibilidad: el foco y el teclado no cruzan el borde de
   un `iframe`, venga de una URL o de un blob. Por eso este diálogo NO promete
   modalidad (ver el comentario de `aria-modal` más abajo). Servir el PDF sin iframe
   exigiría otra cosa (PDF.js en el mismo documento), no tocar ese header. */

const iconCls =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function DteActions({ url, label }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-xs text-neutral-light">Sin información</span>;
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

/* GESTO: click, no hover. Decisión de UX (cuaderno 2026-08-23, U3).
   El preview abría a los 280 ms de hover y RECIÉN AHÍ empezaba a traer el PDF,
   que tarda ~2,94 s medidos contra una BHE real. Eso dejaba ~2,7 s de popover
   abierto y vacío, y como el cierre también colgaba del mouse, el movimiento
   natural de quien piensa "no pasa nada" lo cerraba justo antes de que llegara
   el documento. La percepción resultante fue "no se ve".
   Una espera de 3 segundos no puede depender de que el usuario no mueva la mano:
   el hover es un gesto barato y ambiguo (se dispara sin intención), y el click es
   un compromiso explícito que justifica hacer esperar. Además el hover no existe
   en touch, y el `onFocus` que lo acompañaba abría el popover —y disparaba la
   consulta al SII— con solo tabular por la tabla.
   Ahora: click abre y queda abierto hasta que el usuario cierre (Escape, ✕ o
   click afuera) o hasta que scrollee/redimensione (la posición es `fixed` y no
   se recalcula, así que quedaría flotando desprendida del ícono).
   Descartado: precargar el PDF en hover. Cada preview es una consulta REAL al
   SII a través del backend; prefetchear al pasar el mouse por una tabla de 50
   filas dispararía decenas de descargas que nadie pidió, contra una fuente que
   el propio proyecto tiene throttleada. La espera es honesta — lo que faltaba
   era decirla. */
function DtePreview({ url, suffix }: { url: string; suffix: string }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [cause, setCause] = React.useState<DtePreviewError>({ kind: "generic" });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  /* Trae el PDF por fetch (credenciales) y lo sirve como blob same-origin. Solo
     cuando el popover abre. El rodeo por blob no lo exige el backend —ver la nota
     de la cabecera—, pero sí deja leer y clasificar la respuesta de error para
     mostrar la CTA correcta, que un <iframe src> no permite. */
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

  /** Cierra devolviendo el foco al ícono: el popover también se abre por teclado. */
  const closeAndRefocus = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Escape cierra, y un click fuera del panel también — el popover ya no se
     cierra solo al sacar el mouse, así que necesita salidas obvias además del ✕. */
  React.useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAndRefocus();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, closeAndRefocus]);

  /* Al pasar de hover a click esto se volvió un diálogo de verdad, y un
     `role="dialog"` al que el foco no entra es una trampa: el portal cuelga del
     final del `body`, así que con lector de pantalla el ✕ y el CTA "Ir a
     Credenciales" quedaban después de TODA la página. Al abrir, el foco va al ✕
     — el control que siempre existe, en los tres estados del panel. */
  React.useEffect(() => {
    if (!open || !pos) return;
    closeRef.current?.focus();
  }, [open, pos]);

  /* Retención de foco, con un límite declarado.
     Lo que SÍ hace: mientras el foco está en un control del panel que vive en
     ESTE documento (el ✕, el CTA de credenciales, el link de descarga), Tab y
     Shift+Tab circulan entre ellos en vez de escaparse a la tabla de atrás.
     Lo que NO hace, y por eso este diálogo NO declara `aria-modal`: una vez que
     el foco entra al `iframe` del PDF, se acabó. El `keydown` que ocurre dentro
     de otro documento no burbujea al padre, así que ni esta función ni el
     listener de Escape llegan a verlo — no es un descuido que se arregle con
     más handlers acá, es cómo funcionan los eventos entre documentos. Con el
     PDF cargado, Tab termina saliendo del diálogo y Escape no cierra.
     Por eso: sin `aria-modal`. Declararlo le prometería al lector de pantalla
     que el fondo no está disponible, cuando en el estado normal de uso sí se
     puede tabular hacia él. Es un diálogo NO modal — coherente con que el click
     afuera lo cierre y con que el fondo siga clickeable.
     El `iframe` se deja en la lista de focusables a propósito: sacarlo cerraría
     la fuga, pero a costa de volver el PDF inalcanzable por teclado. Entre
     mentir sobre la modalidad y dejar el documento fuera del alcance del
     teclado, preferimos no mentir. */
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const activo = document.activeElement;
    if (e.shiftKey && (activo === first || !panel.contains(activo))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (activo === last || !panel.contains(activo))) {
      e.preventDefault();
      first.focus();
    }
  }

  /* La posición es `fixed` y no se recalcula: al scrollear/resize la cerramos
     para que no quede flotando desprendida del ícono. */
  React.useEffect(() => {
    if (!open) return undefined;
    const onMove = () => setOpen(false);
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
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
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
            ref={panelRef}
            role="dialog"
            /* Sin `aria-modal`: ver `trapTab`. El foco se retiene entre los
               controles del panel, pero el `iframe` del PDF es una fuga que no
               se puede cerrar desde este documento, así que no prometemos
               modalidad. */
            aria-label={`Vista previa del DTE${suffix}`}
            onKeyDown={trapTab}
            className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
              <span className="truncate text-xs font-medium text-neutral-dark">
                Vista previa del DTE{suffix}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={closeAndRefocus}
                aria-label="Cerrar la vista previa"
                className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-neutral-dark focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {state === "ready" && blobUrl ? (
                <iframe
                  src={blobUrl}
                  title={`Vista previa del DTE${suffix}`}
                  className="h-full w-full"
                />
              ) : state === "loading" ? (
                <DtePreviewSkeleton />
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
                    Ir a Credenciales
                  </Link>
                </div>
              ) : (
                /* Fallback honesto: declara el fallo sin reenviar el diagnóstico interno.
                   En ambos casos se conserva la descarga disponible. */
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
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* Carga inequívoca desde el PRIMER frame (Ley 8: "cargando…" infinito prohibido;
   los esqueletos llevan texto). Antes acá había un spinner solo y un `sr-only`: el
   popover se veía vacío y el usuario no tenía forma de saber si estaba pasando algo
   ni que moverse lo cancelaba. El esqueleto con forma de documento comunica QUÉ va a
   aparecer y el texto dice DÓNDE lo estamos buscando. Ya NO se publica una duración
   estimada: el tiempo lo pone el SII y no lo medimos por consulta. */
function DtePreviewSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div
        aria-hidden="true"
        className="w-full max-w-[20rem] animate-pulse space-y-2.5 rounded-md border border-border bg-surface p-4 shadow-sm"
      >
        <div className="h-3 w-1/2 rounded bg-surface-muted" />
        <div className="h-2 w-1/3 rounded bg-surface-muted" />
        <div className="h-px w-full bg-border" />
        <div className="h-2 w-full rounded bg-surface-muted" />
        <div className="h-2 w-5/6 rounded bg-surface-muted" />
        <div className="h-2 w-2/3 rounded bg-surface-muted" />
        <div className="h-2 w-4/5 rounded bg-surface-muted" />
        <div className="ml-auto h-3 w-1/3 rounded bg-surface-muted" />
      </div>
      <p className="flex items-center gap-2 text-sm font-medium text-neutral-dark">
        <Loader2 className="h-4 w-4 animate-spin text-brand-primary" aria-hidden="true" />
        Buscando el documento en el SII…
      </p>
      <p className="max-w-[20rem] text-xs leading-relaxed text-neutral-mid">
        El SII genera el PDF en el momento. Esta ventana queda abierta hasta que la cierres.
      </p>
    </div>
  );
}
