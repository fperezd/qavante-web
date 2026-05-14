"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import type { SiiCompanyStatus } from "@/lib/api/credentials";
import { formatDateEsCL } from "./format";

/* Dialog lazy: el form + react-hook-form + zod sólo se cargan al abrir.
   Reduce First Load JS de /administracion/credenciales (audit K.4 #2). */
const SiiCompanyDialog = dynamic(
  () => import("./sii-company-dialog").then((m) => ({ default: m.SiiCompanyDialog })),
  { ssr: false },
);

interface Props {
  company: SiiCompanyStatus;
}

export function SiiCompanyCard({ company }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span>Credenciales SII — Empresa</span>
          </div>
        }
      >
        {company.configured ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-neutral-mid">RUT empresa</p>
                <p className="font-medium text-neutral-dark">{company.rut}</p>
              </div>
              <QavanteBadge variant="success">Configurada</QavanteBadge>
            </div>
            {company.last_rotated_at && (
              <p className="text-xs text-neutral-mid">
                Última rotación: {formatDateEsCL(company.last_rotated_at)}
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
              Cargá la clave del portal SII de tu empresa para que Qavante pueda ingestar tus F29 y
              Previred automáticamente.
            </p>
            <div className="flex justify-end pt-2">
              <QavanteButton size="sm" onClick={() => setOpen(true)}>
                Configurar
              </QavanteButton>
            </div>
          </div>
        )}
      </QavanteCard>
      <SiiCompanyDialog open={open} onOpenChange={setOpen} company={company} />
    </>
  );
}
