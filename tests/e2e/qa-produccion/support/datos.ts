/* Lecturas GET reutilizables (mismas rutas y parámetros que usa la app, ver src/lib/api/*.ts).
   NO es un spec. */

import type { ApiLectura } from "./fixtures";
import type {
  AccountsPayable,
  BankAccount,
  BankAccountsResponse,
  BankMovement,
  BankMovementsList,
  CollectionForecast,
  DashboardSummary,
  ReviewItem,
  ReviewQueue,
  SourcesStatus,
  WorkInbox,
} from "./tipos";

/** Tope del `limit` que acepta GET /api/bank-movements (src/lib/api/treasury.ts). */
export const LIMITE_MOVIMIENTOS = 500;

function q(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
}

/** Cuentas con las inactivas (`?active=false`), como Banco y el resumen de pendientes. */
export async function cuentas(api: ApiLectura): Promise<BankAccount[]> {
  const r = await api.get<BankAccountsResponse>("/api/treasury/bank-accounts?active=false");
  return r.json?.items ?? [];
}

export async function resumen(
  api: ApiLectura,
): Promise<{ status: number; data: DashboardSummary | null }> {
  const r = await api.get<DashboardSummary>("/api/dashboard/summary");
  return { status: r.status, data: r.json };
}

/** Lo que Bandeja muestra en Clasificar (sin período), hasta el tope del contrato. */
export async function sinClasificar(
  api: ApiLectura,
  empresa: string,
): Promise<{ items: BankMovement[]; total: number }> {
  const r = await api.get<BankMovementsList>(
    `/api/bank-movements${q({ status: "unclassified", legal_entity_id: empresa, limit: LIMITE_MOVIMIENTOS })}`,
  );
  return { items: r.json?.items ?? [], total: r.json?.total ?? r.json?.items?.length ?? 0 };
}

/** Lo que Caja cuenta como pendiente: mes anterior + mes en curso (useUnclassifiedInRange). */
export async function sinClasificarComoCaja(
  api: ApiLectura,
  hoy: Date = new Date(),
): Promise<{ items: BankMovement[]; total: number; periodos: string[] }> {
  const per = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const periodos = [per(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), per(hoy)];
  let total = 0;
  const items: BankMovement[] = [];
  for (const period of periodos) {
    const r = await api.get<BankMovementsList>(
      `/api/bank-movements${q({ status: "unclassified", period, limit: LIMITE_MOVIMIENTOS })}`,
    );
    total += r.json?.total ?? r.json?.items?.length ?? 0;
    items.push(...(r.json?.items ?? []));
  }
  return { items, total, periodos };
}

export async function revision(
  api: ApiLectura,
  empresa: string,
): Promise<{ items: ReviewItem[]; count: number; status: number }> {
  const r = await api.get<ReviewQueue>(
    `/api/treasury/reconciliation/review${q({ legal_entity_id: empresa })}`,
  );
  return { items: r.json?.items ?? [], count: r.json?.count ?? 0, status: r.status };
}

export async function bandejaDeTrabajo(
  api: ApiLectura,
  empresa: string,
): Promise<WorkInbox | null> {
  if (!empresa) return null;
  const r = await api.get<WorkInbox>(`/api/treasury/work-inbox${q({ legal_entity_id: empresa })}`);
  return r.json;
}

export async function cobranza(api: ApiLectura): Promise<CollectionForecast | null> {
  return (await api.get<CollectionForecast>("/api/treasury/collection-forecast")).json;
}

export async function porPagar(api: ApiLectura): Promise<AccountsPayable | null> {
  return (await api.get<AccountsPayable>("/api/treasury/accounts-payable")).json;
}

export async function fuentes(api: ApiLectura): Promise<SourcesStatus | null> {
  return (await api.get<SourcesStatus>("/api/sources/status")).json;
}
