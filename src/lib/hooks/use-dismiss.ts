"use client";

import * as React from "react";

/** A11y de popovers/dropdowns: mientras `open`, cierra al hacer clic afuera Y al
 *  presionar Escape, devolviendo el foco al trigger (para que el teclado no quede
 *  atrapado detrás del panel). Devuelve el ref del contenedor a colgar del panel.
 *  `onClose` debe ser estable (useCallback) para no re-suscribir en cada render. */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  triggerRef?: React.RefObject<HTMLElement | null>,
): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);
  return ref;
}
