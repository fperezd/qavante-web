"use client";

import { Users } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function UsuariosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Usuarios</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Quién accede a la información de mi empresa?
        </p>
      </header>
      <QavanteEmpty
        icon={Users}
        title="Gestión de usuarios — construcción en Sprint C0 (issue C0-15)"
        description="Acá vas a poder invitar usuarios con un rol específico (owner, admin, finance_manager, viewer), cambiar roles, suspender accesos y ver el último login. Disponible al cerrar C0-14 (backend) y C0-15 (frontend)."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
