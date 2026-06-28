"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteButton,
  QavanteInput,
  QavanteEmpty,
  QavanteInlineError,
} from "@/components/qavante";
import {
  useForeignPurchases,
  useClassifyForeignPurchase,
  type ForeignPurchaseItem,
} from "@/lib/api/foreign-purchases";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/* Compras al extranjero (Caja). Salen de la cartola de tarjeta. Cada una se
   clasifica con concepto + categoría. Montos: USD crudo (string), CLP operativo
   con formatClp; fechas DD-MM-AAAA. */

export function ForeignPurchasesView() {
  const query = useForeignPurchases();

  if (query.isLoading) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando compras al extranjero"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tus compras al extranjero" />;
  }

  const items = query.data?.items ?? [];

  if (items.length === 0) {
    return (
      <QavanteEmpty
        icon={Globe}
        title="No hay compras al extranjero"
        description="Cuando subas una cartola de tarjeta con compras en el extranjero, las vas a ver acá para clasificarlas."
      />
    );
  }

  const pending = items.filter((p) => p.needs_review).length;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {items.length} {items.length === 1 ? "compra" : "compras"}
          </span>
          {pending > 0 && <QavanteBadge variant="warning">{pending} por clasificar</QavanteBadge>}
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {items.map((p) => (
          <PurchaseRow key={p.id} purchase={p} />
        ))}
      </ul>
    </QavanteCard>
  );
}

function PurchaseRow({ purchase: p }: { purchase: ForeignPurchaseItem }) {
  const classify = useClassifyForeignPurchase();
  const [concept, setConcept] = React.useState(p.concept ?? "");
  const [category, setCategory] = React.useState(p.category ?? "");

  const canSubmit = concept.trim().length >= 1 && category.trim().length >= 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    classify.mutate({ id: p.id, concept: concept.trim(), category: category.trim() });
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-dark">{p.merchant}</p>
          <p className="text-xs text-neutral-mid">
            {formatDateLike(p.op_date)}
            {p.country && <> · {p.country}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums text-neutral-dark">USD {p.amount_usd}</p>
          {p.clp_operative && (
            <p className="text-xs text-neutral-mid tabular-nums">
              {formatClp(Number(p.clp_operative))}
            </p>
          )}
        </div>
      </div>

      {p.needs_review ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1 space-y-1">
            <label htmlFor={`concept-${p.id}`} className="text-xs text-neutral-mid">
              Concepto
            </label>
            <QavanteInput
              id={`concept-${p.id}`}
              placeholder="Suscripción software"
              value={concept}
              onValueChange={setConcept}
            />
          </div>
          <div className="min-w-[8rem] flex-1 space-y-1">
            <label htmlFor={`category-${p.id}`} className="text-xs text-neutral-mid">
              Categoría
            </label>
            <QavanteInput
              id={`category-${p.id}`}
              placeholder="Gastos operativos"
              value={category}
              onValueChange={setCategory}
            />
          </div>
          <QavanteButton type="submit" size="sm" loading={classify.isPending} disabled={!canSubmit}>
            Clasificar
          </QavanteButton>
        </form>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <QavanteBadge variant="success">Clasificada</QavanteBadge>
          {p.concept && <span className="text-neutral-dark">{p.concept}</span>}
          {p.category && <span className="text-neutral-mid">· {p.category}</span>}
        </div>
      )}

      {classify.isError && <QavanteInlineError error={classify.error} what="la clasificación" />}
    </li>
  );
}
