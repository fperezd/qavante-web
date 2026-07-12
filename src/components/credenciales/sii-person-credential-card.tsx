"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { UserCheck } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";

/* Card de la CLAVE DEL REPRESENTANTE SII. Es la credencial (persona autorizada)
   con la que el SII permite descargar el DTE por clave (facturas emitidas/recibidas
   como PDF). Antes solo se cargaba en el onboarding; acá el dueño puede (re)ingresarla
   o rotarla cuando la sesión del SII caduca. Sin GET de estado fiable → tras guardar
   se muestra un estado efímero "Guardada" (se pierde al recargar). Dialog lazy. */
const SiiPersonCredentialDialog = dynamic(
  () =>
    import("./sii-person-credential-dialog").then((m) => ({
      default: m.SiiPersonCredentialDialog,
    })),
  { ssr: false },
);

export function SiiPersonCredentialCard() {
  const [open, setOpen] = React.useState(false);
  const [savedThisSession, setSavedThisSession] = React.useState(false);

  return (
    <>
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span>Clave del representante (SII)</span>
          </div>
        }
      >
        <div className="space-y-3">
          {savedThisSession && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-neutral-mid">Clave del representante</p>
              <QavanteBadge variant="success">Guardada</QavanteBadge>
            </div>
          )}
          <p className="text-sm text-neutral-mid">
            Con esta clave (la de la persona autorizada en el SII) Qavante puede descargar tus DTE —
            las facturas emitidas y recibidas — como PDF. Si el DTE deja de verse, reingresá la clave
            acá: la sesión del SII pudo caducar. La clave se encripta antes de guardarse.
          </p>
          <div className="flex justify-end pt-1">
            {/* Etiquetas DISTINTAS de las del card del RCV ("Configurar"/"Cambiar
                clave") a propósito: dos botones iguales lado a lado confunden, y el
                e2e ancla el del RCV. */}
            {savedThisSession ? (
              <QavanteButton size="sm" variant="ghost" onClick={() => setOpen(true)}>
                Actualizar clave
              </QavanteButton>
            ) : (
              <QavanteButton size="sm" onClick={() => setOpen(true)}>
                Ingresar clave
              </QavanteButton>
            )}
          </div>
        </div>
      </QavanteCard>
      <SiiPersonCredentialDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => setSavedThisSession(true)}
      />
    </>
  );
}
