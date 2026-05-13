import { Suspense } from "react";
import { AceptarInvitacionForm } from "./form";

/* Route pública para aceptar invitaciones recibidas por email (C0-15).
   Link: https://app.qavante.com/aceptar-invitacion?token=xxx.
   No requiere cookie (el middleware ya excluye esta ruta). */
export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-mid">Cargando…</div>}>
      <AceptarInvitacionForm />
    </Suspense>
  );
}
