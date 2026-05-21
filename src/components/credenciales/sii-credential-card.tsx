"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import type { CredentialMetadataResponse } from "@/lib/api/credentials";
import { formatDateEsCL } from "./format";

/* Card del bloque ÚNICO de credencial SII (Opción A: una credencial por
   tenant — `source_code=sii_rcv`). NO hay persons[] (fuera de scope, regla
   16). Dialog lazy para no inflar el First Load del page. */
const SiiCredentialDialog = dynamic(
  () => import("./sii-credential-dialog").then((m) => ({ default: m.SiiCredentialDialog })),
  { ssr: false },
);

interface Props {
  credential: CredentialMetadataResponse;
}

export function SiiCredentialCard({ credential }: Props) {
  const [open, setOpen] = React.useState(false);
  const active = credential.is_active;

  return (
    <>
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span>{credential.human_label || "Credencial SII"}</span>
          </div>
        }
      >
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-neutral-mid">{credential.label || "Clave Tributaria SII"}</p>
              <QavanteBadge variant="success">Configurada</QavanteBadge>
            </div>
            {credential.created_at && (
              <p className="text-xs text-neutral-mid">
                Configurada: {formatDateEsCL(credential.created_at)}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <QavanteButton size="sm" variant="ghost" onClick={() => setOpen(true)}>
                Cambiar clave
              </QavanteButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-mid">
              Cargá la clave tributaria del SII para que Qavante pueda ingestar tus F29 y RCV
              automáticamente. La clave se encripta antes de guardarse.
            </p>
            <div className="flex justify-end pt-2">
              <QavanteButton size="sm" onClick={() => setOpen(true)}>
                Configurar
              </QavanteButton>
            </div>
          </div>
        )}
      </QavanteCard>
      <SiiCredentialDialog open={open} onOpenChange={setOpen} active={active} />
    </>
  );
}
