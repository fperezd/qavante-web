import { UserCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { MiCuentaView } from "@/components/mi-cuenta/mi-cuenta-view";

/* Pantalla "Mi cuenta": perfil del usuario logueado + cerrar sesión.

   **Server Component** (como inicio/caja/cobrar/pagar): resuelve `miCuenta` en
   runtime del Worker. NO debe llevar `"use client"`: el lookup de la flag usa
   una key computada (`NEXT_PUBLIC_FF_MI_CUENTA`) que Next.js NO inlinea, así que
   en el cliente daría `undefined` → flag siempre OFF → la pantalla quedaría
   inerte al prenderla en wrangler.toml. `MiCuentaView` es el Client Component
   que consume los datos.

   MVP (flag `miCuenta` ON): consume `/api/me` (info de usuario con cookie
   auth) y expone logout vía `POST /api/auth/logout`.

   Flag OFF (default): QavanteEmpty informativo (patrón "MVP honesto"
   ADR-0013). El avatar del header siempre enlaza acá; con el flag OFF el
   usuario ve el placeholder en lugar de UI a medio cablear. */
export default function MiCuentaPage() {
  const { miCuenta } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Mi cuenta</h1>
        <p className="mt-1 text-sm text-neutral-mid">Tu perfil y tu sesión.</p>
      </header>

      {miCuenta ? (
        <MiCuentaView />
      ) : (
        <QavanteEmpty
          icon={UserCircle}
          title="Mi cuenta — disponible pronto"
          description="Aquí vas a ver tu perfil, tu rol en la empresa y vas a poder cerrar sesión. Se habilita cuando se active la sección."
        />
      )}
    </div>
  );
}
