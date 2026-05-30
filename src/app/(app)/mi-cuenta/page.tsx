"use client";

import { UserCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { MiCuentaView } from "@/components/mi-cuenta/mi-cuenta-view";

/* Pantalla "Mi cuenta": perfil del usuario logueado + cerrar sesión.

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
          description="Acá vas a ver tu perfil, tu rol en la empresa y vas a poder cerrar sesión. Se habilita cuando se active la sección."
        />
      )}
    </div>
  );
}
