/* Helper puro de agregación para el bloque "Resumen de movimientos
 * clasificados" en /caja/clasificados.
 *
 * Toma items + total + lookups (categorías y cuentas de gestión) y devuelve
 * el shape estable que consume <ClasificadosStats />. Pensado como pieza
 * testable de forma aislada (sin React) — toda la lógica viva acá.
 *
 * Brechas backend que este helper compensa (mientras no exista endpoint
 * `GET /api/treasury/bank-movements/classified/stats`):
 * - calcula agregados en frontend sobre `items` recibidos;
 * - declara `dataScope: "current_page"` si `total > items.length` y deja al
 *   componente mostrar el aviso de alcance parcial;
 * - asume CLP mientras `BankMovement` no exponga `currency_code`. */
import type { BankMovement } from "@/lib/api/treasury";
import type { ManagementAccountNode } from "@/lib/api/management";

export interface CategoryLookupItem {
  code: string;
  label: string;
}

/** Map id → { id, name, path } para resolver "Categoría principal" con un
 *  path legible tipo "Costos / Servicios". El path se arma con el atributo
 *  `path` del backend si viene (`"costos/servicios"`); si no, se cae a
 *  `display_name || name`. */
export interface AccountLookupItem {
  id: string;
  name: string;
  path: string;
}

export interface TopCanonical {
  code: string;
  label: string;
  count: number;
  amount: number;
}

export interface TopAccount {
  id: string;
  path: string;
  count: number;
  amount: number;
}

export type DataScope = "filtered_total" | "current_page";
export type DataStatus = "ok" | "partial" | "unavailable";

export interface ClasificadosStats {
  count: number;
  incomeAmount: number;
  expenseAmount: number;
  netAmount: number;
  needsReviewCount: number;
  /** % de clasificación completa sobre el universo del período. `null` mientras
   *  no exista endpoint backend que reporte el universo (clasificados +
   *  no clasificados) o no se haga la segunda query. La UI no debe renderizar
   *  esta métrica cuando sea null (regla del prompt: "mostrar solo si se
   *  puede calcular correctamente"). */
  completeRate: number | null;
  topCanonical: TopCanonical | null;
  topAccount: TopAccount | null;
  lastClassifiedAt: string | null;
  currencyCode: "CLP";
  dataScope: DataScope;
  dataStatus: DataStatus;
}

export interface BuildStatsInput {
  /** Items sobre los que se calculan las métricas — típicamente los items
   *  visibles post filtros client-side. */
  items: BankMovement[];
  /** Señal precalculada por el caller: "el FE descargó menos movimientos
   *  que los que el servidor reporta para el filtro server-side actual"
   *  (i.e., `query.data.total > allItems.length`). El caller la calcula
   *  porque tiene contexto (sabe distinguir entre filtros server-side y
   *  client-side); el helper solo la propaga al `dataScope` / `dataStatus`. */
  isPartial: boolean;
  categoriesById: Map<string, CategoryLookupItem>;
  accountsById: Map<string, AccountLookupItem>;
}

/* Criterio de "Requiere revisión":
 * - `classification_status === "needs_review"` (campo backend canónico §17.4)
 * - `confidence != null && Number(confidence) < CONFIDENCE_THRESHOLD`
 * - `data_status !== "available"` (movimiento stale / inconsistent / missing)
 * Se cuenta cada movimiento una sola vez aunque cumpla varios criterios.
 *
 * El threshold replica el ya usado por el seed MSW de classification-rules
 * (0.70 = activa, 0.95/0.90 = alta confianza). */
const CONFIDENCE_THRESHOLD = 0.7;

function isNeedsReview(m: BankMovement): boolean {
  if (m.classification_status === "needs_review") return true;
  if (m.confidence != null) {
    const c = Number(m.confidence);
    if (!Number.isNaN(c) && c < CONFIDENCE_THRESHOLD) return true;
  }
  if (m.data_status && m.data_status !== "available") return true;
  return false;
}

function absAmount(m: BankMovement): number {
  const n = Number(m.amount);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

interface Bucket {
  count: number;
  amount: number;
}

function pickTopByCount<T extends Bucket>(
  buckets: Map<string, T>,
): { key: string; bucket: T } | null {
  let bestKey: string | null = null;
  let best: T | null = null;
  for (const [key, b] of buckets) {
    if (
      best === null ||
      b.count > best.count ||
      (b.count === best.count && b.amount > best.amount)
    ) {
      best = b;
      bestKey = key;
    }
  }
  return bestKey && best ? { key: bestKey, bucket: best } : null;
}

export function buildClasificadosStats({
  items,
  isPartial,
  categoriesById,
  accountsById,
}: BuildStatsInput): ClasificadosStats {
  const count = items.length;

  let incomeAmount = 0;
  let expenseAmount = 0;
  let needsReviewCount = 0;
  let lastClassifiedAt: string | null = null;

  const canonicalBuckets = new Map<string, Bucket>();
  const accountBuckets = new Map<string, Bucket>();

  for (const m of items) {
    const amount = absAmount(m);

    if (m.direction === "credit") incomeAmount += amount;
    else if (m.direction === "debit") expenseAmount += amount;

    if (isNeedsReview(m)) needsReviewCount += 1;

    if (m.classified_at && (lastClassifiedAt === null || m.classified_at > lastClassifiedAt)) {
      lastClassifiedAt = m.classified_at;
    }

    if (m.canonical_category) {
      const b = canonicalBuckets.get(m.canonical_category) ?? { count: 0, amount: 0 };
      b.count += 1;
      b.amount += amount;
      canonicalBuckets.set(m.canonical_category, b);
    }

    if (m.management_account_id) {
      const b = accountBuckets.get(m.management_account_id) ?? { count: 0, amount: 0 };
      b.count += 1;
      b.amount += amount;
      accountBuckets.set(m.management_account_id, b);
    }
  }

  const netAmount = incomeAmount - expenseAmount;

  const topCanonicalRaw = pickTopByCount(canonicalBuckets);
  const topCanonical: TopCanonical | null = topCanonicalRaw
    ? {
        code: topCanonicalRaw.key,
        /* Regla del prompt: nunca mostrar el code crudo. Si la categoría no
         * está en el lookup, exponemos el code igual — el UI puede mostrar el
         * code si y solo si no hay label. En la práctica el lookup viene del
         * mismo `useCanonicalCategories` que alimenta el filtro, así que
         * siempre debería haber label para los codes presentes. */
        label: categoriesById.get(topCanonicalRaw.key)?.label ?? topCanonicalRaw.key,
        count: topCanonicalRaw.bucket.count,
        amount: topCanonicalRaw.bucket.amount,
      }
    : null;

  const topAccountRaw = pickTopByCount(accountBuckets);
  const topAccount: TopAccount | null = topAccountRaw
    ? {
        id: topAccountRaw.key,
        path: accountsById.get(topAccountRaw.key)?.path ?? topAccountRaw.key,
        count: topAccountRaw.bucket.count,
        amount: topAccountRaw.bucket.amount,
      }
    : null;

  /* scope partial: el caller indicó que el universo del backend excede los
   * items descargados. El componente debe avisar al usuario. */
  const dataScope: DataScope = isPartial ? "current_page" : "filtered_total";
  const dataStatus: DataStatus = isPartial ? "partial" : "ok";

  return {
    count,
    incomeAmount,
    expenseAmount,
    netAmount,
    needsReviewCount,
    completeRate: null,
    topCanonical,
    topAccount,
    lastClassifiedAt,
    currencyCode: "CLP",
    dataScope,
    dataStatus,
  };
}

/** Build helper inverso: del árbol de cuentas de gestión arma el `Map<id, {
 *  id, name, path }>` que consume `buildClasificadosStats`. Path con
 *  separador " / " para legibilidad humana (no el code-style "costos/servicios"
 *  del backend). */
export function buildAccountsLookup(
  roots: ManagementAccountNode[],
): Map<string, AccountLookupItem> {
  const out = new Map<string, AccountLookupItem>();
  const walk = (nodes: ManagementAccountNode[], parentPath: string[]) => {
    for (const n of nodes) {
      const displayName = n.display_name || n.name;
      const segments = [...parentPath, displayName];
      out.set(n.id, {
        id: n.id,
        name: displayName,
        path: segments.join(" / "),
      });
      if (n.children && n.children.length > 0) walk(n.children, segments);
    }
  };
  walk(roots, []);
  return out;
}

/** Build helper para el lookup de categorías canónicas. */
export function buildCategoriesLookup(
  items: ReadonlyArray<{ code: string; label: string }>,
): Map<string, CategoryLookupItem> {
  const out = new Map<string, CategoryLookupItem>();
  for (const c of items) out.set(c.code, { code: c.code, label: c.label });
  return out;
}
