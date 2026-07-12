"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { UserCheck } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import type { SiiPersonStatus } from "@/lib/api/credentials";
import { formatDateEsCL } from "./format";

/* Card de la CLAVE DEL REPRESENTANTE SII. Es la credencial (persona autorizada)
   con la que el SII permite descargar el DTE por clave (facturas emitidas/recibidas
   como PDF). Antes solo se cargaba en el onboarding; acá el dueño la (re)ingresa o
   rota cuando la sesión del SII caduca. Prop-driven: la página pasa `persons` desde
   `GET /api/credentials/sii` → el RUT registrado queda PERSISTIDO (no efímero).
   Dialog lazy. */
const SiiPersonCredentialDialog = dynamic(
  () =>
    import("./sii-person-credential-dialog").then((m) => ({
      default: m.SiiPersonCredentialDialog,
    })),
  { ssr: false },
);

interface Props {
  /** Personas (representantes) registradas — de `GET /api/credentials/sii`. */
  persons?: SiiPersonStatus[] | null;
}

export function SiiPersonCredentialCard({ persons }: Props) {
  const [open, setOpen] = React.useState(false);
  const registered = (persons ?? []).find((p) => p.configured) ?? null;

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
        {registered ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-neutral-dark">
                  {registered.name || "Representante registrado"}
                </p>
                <p className="tabular-nums text-neutral-mid">{registered.rut}</p>
              </div>
              <QavanteBadge variant="success">Configurada</QavanteBadge>
            </div>
            {registered.last_rotated_at && (
              <p className="text-xs text-neutral-mid">
                Actualizada: {formatDateEsCL(registered.last_rotated_at)}
              </p>
            )}
            <div className="flex justify-end pt-1">
              <QavanteButton size="sm" variant="ghost" onClick={() => setOpen(true)}>
                Actualizar clave
              </QavanteButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-mid">
              Con esta clave (la de la persona autorizada en el SII) Qavante puede descargar tus DTE
              — las facturas emitidas y recibidas — como PDF. Si el DTE deja de verse, reingresá la
              clave acá: la sesión del SII pudo caducar. La clave se encripta antes de guardarse.
            </p>
            <div className="flex justify-end pt-1">
              <QavanteButton size="sm" onClick={() => setOpen(true)}>
                Ingresar clave
              </QavanteButton>
            </div>
          </div>
        )}
      </QavanteCard>
      <SiiPersonCredentialDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
