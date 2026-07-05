"use client";

import * as React from "react";
import { toast } from "sonner";
import { Link2, CheckCircle2, Landmark } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteBadge, QavanteInlineError } from "@/components/qavante";
import {
  useBiceAccounts,
  useCreateBankAccount,
  useLinkBiceAccount,
  type BiceAccount,
} from "@/lib/api/treasury";

/* Cuentas por vincular (handoff CC-API). Cuando BICE trae cuentas nuevas quedan
   en cuarentena (`linked_bank_account_id === null`) hasta mapearlas a una
   `treasury.bank_accounts`. UX simple (pedido de Fernando): un botón "Vincular"
   por cuenta que en UN paso crea la cuenta Qavante y la linkea — sin wizard.
   Owner/admin. */

export function LinkBankAccountsCard() {
  const biceQuery = useBiceAccounts();
  const createAccount = useCreateBankAccount();
  const linkAccount = useLinkBiceAccount();
  const [linkingId, setLinkingId] = React.useState<string | null>(null);

  async function vincular(acct: BiceAccount) {
    setLinkingId(acct.external_id);
    try {
      // 1 clic = crear la cuenta Qavante con los datos de BICE…
      const created = await createAccount.mutateAsync({
        bank_name: "BICE",
        account_name: acct.name || `Cuenta ····${acct.external_id.slice(-4)}`,
        currency_code: acct.currency || "CLP",
        account_type: "checking",
        account_number_masked: acct.external_id,
      });
      // …y vincularla.
      await linkAccount.mutateAsync({ externalId: acct.external_id, bankAccountId: created.id });
      toast.success("Cuenta vinculada", {
        description: `${acct.name ?? acct.external_id} · ${acct.currency ?? "CLP"} — ya puedes sincronizar sus movimientos.`,
      });
    } catch {
      toast.error("No pudimos vincular la cuenta", {
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setLinkingId(null);
    }
  }

  const accounts = biceQuery.data?.accounts ?? [];
  const pending = accounts.filter((a) => !a.linked_bank_account_id);

  // Sin cuentas de BICE en absoluto → no mostramos la card (nada que vincular).
  if (!biceQuery.isLoading && !biceQuery.isError && accounts.length === 0) return null;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Cuentas de tu banco</span>
        </div>
      }
    >
      {biceQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-neutral-light/30" aria-busy="true" />
      ) : biceQuery.isError ? (
        <QavanteInlineError
          error={biceQuery.error}
          what="las cuentas de tu banco"
          onRetry={() => biceQuery.refetch()}
        />
      ) : pending.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Todas tus cuentas están vinculadas. Ya puedes sincronizar sus movimientos.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-mid">
            Detectamos {pending.length} {pending.length === 1 ? "cuenta nueva" : "cuentas nuevas"}{" "}
            en tu banco. Vincúlala para traer sus movimientos.
          </p>
          <ul className="divide-y divide-border">
            {pending.map((acct) => {
              const busy = linkingId === acct.external_id;
              return (
                <li
                  key={acct.external_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-neutral-dark">
                      <span className="truncate">
                        {acct.name || `Cuenta ····${acct.external_id.slice(-4)}`}
                      </span>
                      <QavanteBadge variant="info">{acct.currency ?? "CLP"}</QavanteBadge>
                    </p>
                    <p className="font-mono text-xs text-neutral-mid">
                      ····{acct.external_id.slice(-4)}
                    </p>
                  </div>
                  <QavanteButton
                    size="sm"
                    loading={busy}
                    disabled={Boolean(linkingId)}
                    onClick={() => vincular(acct)}
                  >
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    Vincular
                  </QavanteButton>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </QavanteCard>
  );
}
