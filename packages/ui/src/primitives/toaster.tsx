"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

/* Toaster — se monta UNA sola vez en el provider raíz del consumidor.
   `richColors` mapea success/error/warning a la semántica; hereda la tipografía
   del consumidor vía `font-sans`. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      gap={8}
      toastOptions={{ classNames: { toast: "rounded-xl border border-border font-sans" } }}
    />
  );
}
