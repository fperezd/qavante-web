"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { isLocalDevAppEnv } from "@/lib/app-env";
import { cn } from "@/lib/utils";

/** Marcador «!» de API pendiente: solo en entorno local de desarrollo.
 *  El dialog se porta a `document.body` para no anidar `<dialog>`/`<form>`/`<p>`
 *  dentro de wrappers de texto (`<p>`, `<span>`) — eso rompe la hidratación. */
export function InicioApiPendienteButton({
  mensaje,
  className,
}: {
  mensaje: string;
  className?: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isLocalDevAppEnv()) return null;

  const dialog =
    mounted &&
    createPortal(
      <dialog
        ref={dialogRef}
        className="max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg backdrop:bg-neutral-dark/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <p className="text-sm font-semibold text-neutral-dark">API pendiente</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-mid">{mensaje}</p>
        <form method="dialog" className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Entendido
          </button>
        </form>
      </dialog>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold leading-none text-amber-900 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
          className,
        )}
        aria-label="Dato no conectado a la API"
        onClick={() => dialogRef.current?.showModal()}
      >
        !
      </button>
      {dialog}
    </>
  );
}
