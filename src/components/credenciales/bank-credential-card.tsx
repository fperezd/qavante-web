"use client";

import { QavanteCard } from "@/components/qavante";
import { Landmark } from "lucide-react";
import { QavanteBankConnectWidget } from "@/components/banco/qavante-bank-connect-widget";

export function BankCredentialCard() {
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Banco</span>
        </div>
      }
    >
      <p className="mb-4 text-sm text-neutral-mid">
        Conecta una o más instituciones con Fintoc. Qavante no pide ni guarda la clave del banco.
      </p>
      <QavanteBankConnectWidget />
    </QavanteCard>
  );
}
