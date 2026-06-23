"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

/* Toaster Qavante — se monta UNA sola vez en AppProviders (Tooxs Frontend
   Standard §6). `richColors` mapea success/error/warning a la semántica de marca;
   `top-right` consistente en todo el producto; hereda la tipografía Sora del body
   vía `font-sans`. El feedback de mutaciones se dispara con `toast.*` (los errores
   de mutación ya van por el `onError` global del QueryClient). */
export function QavanteToaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      gap={8}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-border font-sans",
        },
      }}
    />
  );
}
