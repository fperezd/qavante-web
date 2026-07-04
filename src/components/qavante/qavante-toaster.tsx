"use client";

import { Toaster } from "sonner";

/* Toaster global de Qavante (Ola 2). Envuelve sonner con la identidad visual:
   posición inferior-derecha, cerrar visible, y colores de estado que usan la
   rampa semántica (verde éxito, rojo error). Se monta una sola vez en los
   providers raíz. El feedback por acción (toast + "Deshacer" cuando aplica) da
   la sensación de control en flujos repetitivos (clasificar, registrar, guardar)
   donde antes la fila "simplemente desaparecía" sin confirmación. */
export function QavanteToaster() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{
        style: { fontFamily: "var(--font-sora), system-ui, sans-serif" },
        className: "rounded-xl",
      }}
    />
  );
}
