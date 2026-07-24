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
import { useCanonicalCategories } from "@/lib/api/treasury";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";

/* Compras al extranjero (Caja). Salen de la cartola de tarjeta. Cada una se
   clasifica con concepto + categoría. Montos: USD crudo (string), CLP operativo
   con formatClp; fechas DD-MM-AAAA.

   La categoría NO es texto libre: es una categoría canónica del backend
   (`/canonical-categories`, mismo catálogo que usa la clasificación de banco).
   Filtramos a las de salida (`cashflow_group === "cash_out"`) porque una compra
   con tarjeta al extranjero es siempre un gasto. Guardamos el `code` canónico
   (no el label) para que el dato sea consistente y agregable. */

const SELECT_CLASS = cn(
  "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function ForeignPurchasesView() {
  const query = useForeignPurchases();
  const catsQuery = useCanonicalCategories();

  const categories = React.useMemo(
    () => (catsQuery.data?.items ?? []).filter((c) => c.cashflow_group === "cash_out"),
    [catsQuery.data],
  );
  const categoryLabel = React.useMemo(() => {
    const byCode = new Map(categories.map((c) => [c.code, c.label]));
    // Fallback al string crudo: compras clasificadas antes con texto libre.
    return (code: string | null | undefined) => (code ? (byCode.get(code) ?? code) : "");
  }, [categories]);

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

  // El estado de CLASIFICACIÓN es `status`, no `needs_review` (que es un flag de resolución del
  // tipo de cambio). Una compra con el FX resuelto pero sin clasificar (`status: "sin_clasificar"`)
  // debe seguir apareciendo como pendiente.
  const pending = items.filter((p) => p.status !== "clasificada").length;

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
          <PurchaseRow
            key={p.id}
            purchase={p}
            categories={categories}
            categoryLabel={categoryLabel}
          />
        ))}
      </ul>
    </QavanteCard>
  );
}

type CategoryOption = { code: string; label: string };

function PurchaseRow({
  purchase: p,
  categories,
  categoryLabel,
}: {
  purchase: ForeignPurchaseItem;
  categories: CategoryOption[];
  categoryLabel: (code: string | null | undefined) => string;
}) {
  const classify = useClassifyForeignPurchase();
  const [concept, setConcept] = React.useState(p.concept ?? "");
  const [category, setCategory] = React.useState(p.category ?? "");

  const canSubmit = concept.trim().length >= 1 && category.trim().length >= 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    classify.mutate({ id: p.id, concept: concept.trim(), category });
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
          <p className="font-medium tabular-nums text-neutral-dark">
            {formatMoney(Number(p.amount_usd), "USD")}
          </p>
          {p.clp_operative && (
            <p className="text-xs text-neutral-mid tabular-nums">
              {formatClp(Number(p.clp_operative))}
            </p>
          )}
        </div>
      </div>

      {p.status !== "clasificada" ? (
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
            <select
              id={`category-${p.id}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Elige una categoría…</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <QavanteButton type="submit" size="sm" loading={classify.isPending} disabled={!canSubmit}>
            Clasificar
          </QavanteButton>
        </form>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <QavanteBadge variant="success">Clasificada</QavanteBadge>
          {p.concept && <span className="text-neutral-dark">{p.concept}</span>}
          {p.category && <span className="text-neutral-mid">· {categoryLabel(p.category)}</span>}
        </div>
      )}

      {classify.isError && <QavanteInlineError error={classify.error} what="la clasificación" />}
    </li>
  );
}
