"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function RecuperarClavePage() {
  return (
    <QavanteEmpty
      icon={Mail}
      title="Recuperación de clave: próximamente"
      description="Esta funcionalidad estará disponible al cerrar Sprint C0. Mientras tanto, contacta al administrador de tu empresa para restablecer tu clave."
      cta={
        <Link href="/login">
          <QavanteButton size="sm" variant="ghost">
            Volver al login
          </QavanteButton>
        </Link>
      }
    />
  );
}
