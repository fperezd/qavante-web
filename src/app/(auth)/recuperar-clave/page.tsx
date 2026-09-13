"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function RecuperarClavePage() {
  return (
    <QavanteEmpty
      icon={Mail}
      title="Recuperación de clave no disponible"
      description="Para recuperar el acceso, contacta al administrador de tu empresa."
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
