"use client";

import { BancoView } from "@/components/banco/banco-view";
import { BancoV03PageHeader } from "@/components/banco/banco-v03-page-header";
import { FintocBankActions } from "@/components/banco/fintoc-bank-actions";
import { QavanteBankConnectWidget } from "@/components/banco/qavante-bank-connect-widget";
import { BancoV03Live } from "@/components/banco/v03/banco-v03-live";
import { useCompanyScope } from "@/components/shell/company-scope";
import { useCompanyHasConnectedBank } from "@/lib/api/fintoc-connections";

export function BancoWorkspace({
  bancoV03,
  initialAccountId,
  initialMovementId,
}: {
  bancoV03: boolean;
  initialAccountId?: string;
  initialMovementId?: string;
}) {
  const { activeCompanyId } = useCompanyScope();
  // Los bancos se administran por sociedad en Administración; acá sólo se ofrece el primero.
  const sinBanco = useCompanyHasConnectedBank(activeCompanyId) === false;
  return (
    <div className="space-y-6">
      {bancoV03 ? (
        <BancoV03PageHeader />
      ) : (
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Banco</h1>
            <p className="mt-1 text-sm text-neutral-mid">
              Cuentas conectadas a esta empresa. La administración de bancos está en Credenciales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:justify-end sm:self-auto">
            {sinBanco ? <QavanteBankConnectWidget /> : null}
            <FintocBankActions />
          </div>
        </header>
      )}

      {bancoV03 ? (
        <BancoV03Live initialAccountId={initialAccountId} initialMovementId={initialMovementId} />
      ) : (
        <BancoView />
      )}
    </div>
  );
}
