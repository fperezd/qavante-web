"use client";

import * as React from "react";

/* A11y dinámica (Tooxs Frontend Standard §9) — región `aria-live` global para
   anunciar cambios que no mueven el foco: resultados de filtros, mutaciones,
   actualizaciones async. Se monta UNA vez (en el layout del área autenticada) y
   se dispara desde cualquier parte con `announce(...)`.

   `polite` no interrumpe; `assertive` para errores que el usuario debe oír ya. */

type Politeness = "polite" | "assertive";

interface LiveStore {
  polite: string;
  assertive: string;
  /** Fuerza re-anuncio cuando el mensaje se repite (los SR no re-leen texto igual). */
  nonce: number;
}

let store: LiveStore = { polite: "", assertive: "", nonce: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function announce(message: string, politeness: Politeness = "polite") {
  store = {
    polite: politeness === "polite" ? message : "",
    assertive: politeness === "assertive" ? message : "",
    nonce: store.nonce + 1,
  };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const SR_ONLY =
  "absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]";

export function LiveRegion() {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    () => store,
    () => store,
  );
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className={SR_ONLY}>
        {snapshot.polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" role="alert" className={SR_ONLY}>
        {snapshot.assertive}
      </div>
    </>
  );
}
