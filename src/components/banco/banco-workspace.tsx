"use client";

import Link from "next/link";
import { BancoView } from "@/components/banco/banco-view";
import { FintocBankActions } from "@/components/banco/fintoc-bank-actions";
import { QavanteBankConnectWidget } from "@/components/banco/qavante-bank-connect-widget";
import { BancoV03Live } from "@/components/banco/v03/banco-v03-live";

export function BancoWorkspace({
  bancoV03,
  initialAccountId,
  initialMovementId,
}: {
  bancoV03: boolean;
  initialAccountId?: string;
  initialMovementId?: string;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {bancoV03 ? (
            <>
              <p className="font-rediseno-mono text-[11px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase">
                Banco
              </p>
              <h1 className="mt-1 font-rediseno-sans text-[28px] leading-tight font-medium text-rediseno-tinta">
                Tus cuentas y tarjetas
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-neutral-dark">Banco</h1>
              <p className="mt-1 text-sm text-neutral-mid">
                Cuentas conectadas a esta empresa. La administración de bancos está en Credenciales.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:justify-end sm:self-auto">
          <QavanteBankConnectWidget />
          <FintocBankActions />
        </div>
      </header>

      <nav
        className="flex flex-wrap items-center gap-2 border-b border-rediseno-hairline pb-4"
        aria-label="Secciones de banco"
      >
        <span
          aria-current="page"
          className="rounded-full border border-rediseno-tinta bg-rediseno-tinta px-[13px] py-[7px] text-xs font-semibold text-white"
        >
          Cuentas
        </span>
        <Link
          href="/administracion/credenciales"
          className="rounded-full border border-rediseno-hairline bg-rediseno-superficie px-[13px] py-[7px] text-xs font-semibold text-rediseno-tinta-2 hover:border-rediseno-tinta"
        >
          Bancos conectados
        </Link>
      </nav>

      {bancoV03 ? (
        <BancoV03Live initialAccountId={initialAccountId} initialMovementId={initialMovementId} />
      ) : (
        <BancoView />
      )}
    </div>
  );
}
