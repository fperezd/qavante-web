"use client";

import Link from "next/link";
import { Pill } from "@/components/rediseno/pill";
import { DataState } from "@/components/rediseno/data-state";
import { agreementRowView } from "./acuerdos-model";
import type { FinancialAgreementListItem } from "@/lib/api/financial-agreements";

export function AcuerdosView({ items }: { items: FinancialAgreementListItem[] }) {
  if (items.length === 0) {
    return (
      <DataState
        status="empty"
        what="acuerdos financieros"
        hint="Un acuerdo nace cuando negocias una condición distinta a la declarada en un
        documento (plazo, monto o calendario) y quieres que la caja refleje esa negociación."
      />
    );
  }

  const sorted = [...items].sort((a, b) => b.state_changed_at.localeCompare(a.state_changed_at));

  return (
    <ul className="divide-y divide-rediseno-hairline rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
      {sorted.map((item) => {
        const row = agreementRowView(item);
        return (
          <li key={row.id}>
            <Link
              href={`/acuerdos/${row.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-rediseno-neutro-bg/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-rediseno-tinta">{row.kindLabel}</p>
                <p className="text-[12px] text-rediseno-tinta-2">
                  {row.directionLabel} · {row.currencyCode} · actualizado {row.stateChangedLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!row.isBinding && (
                  <span className="text-[11px] text-rediseno-tinta-3">no vinculante</span>
                )}
                <Pill variant={row.stateVariant}>{row.stateLabel}</Pill>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
