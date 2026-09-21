"use client";

import * as React from "react";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  useBankAccounts,
  useBankMovements,
  useCanonicalCategories,
  useBankMovementResolution,
  useFinancialEventTypes,
  useReplaceBankMovementClassification,
  useUnclassifyBankMovement,
  createTreasuryIdempotencyKey,
  type MovementResolutionDetailResponse,
} from "@/lib/api/treasury";
import { useRevertReconciliation } from "@/lib/api/reconciliation";
import {
  useClassificationDimensions,
  useManagementAccountsTree,
  type ManagementAccountNode,
} from "@/lib/api/management";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { ApiError } from "@/lib/api/errors";
import { unknownErrorToUserMessage } from "@/lib/api/error-messages";
import { toast } from "sonner";
import { BancoV03View } from "./banco-v03-view";
import { resolutionDetailFromApi } from "./bank-resolution-detail-model";
import type { MovimientoV03 } from "./banco-v03-model";

function mutationErrorMessage(error: unknown): string {
  return unknownErrorToUserMessage(error, "No pudimos completar la acción. Intenta nuevamente.");
}

/* Cableado de V03 · Banco. La vista es presentacional; acá se resuelven las fuentes:
 *
 *   · `GET /api/dashboard/summary`               — "Caja hoy" vía `cajaHoy()` (la MISMA fuente que V01/V02);
 *   · `GET /api/treasury/bank-accounts?active=false` — cuentas y saldos que trajo Fintoc;
 *   · `GET /api/sources/status`                    — estado y frescura de la conexión;
 *   · `GET /api/bank-movements` (últimos 3 meses)  — los movimientos con su ciclo de vida;
 *   · `GET /api/treasury/canonical-categories`     — la etiqueta humana de cada categoría.
 *
 * Nada bloquea la pantalla entera: cada sección degrada a su propio "sin dato" con motivo. */

/** `YYYY-MM` de una fecha local. */
function periodo(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Cuántos meses hacia atrás se listan (declarado en la vista como alcance). */
export const MESES_ALCANCE = 3;
/** Filas que se piden de una: el MÁXIMO que el contrato permite (`BANK_MOVEMENTS_LIMIT_MAX`, 500; un
 *  `limit` mayor es 422 y tumba la sección entera). Por encima del tope, la vista lo declara
 *  ("mostrando N de M"). `banco-v03-live.test.ts` lo fija contra el contrato. */
export const LIMITE_MOVIMIENTOS = 500;

export function motivoSinMovimientos(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el listado de movimientos (error de red). Vuelve a intentar en un momento.";
  }
  return "El listado de movimientos no respondió. Vuelve a intentar en un momento.";
}

export function unclassifyFeedback(changed: boolean): {
  kind: "success" | "error";
  message: string;
} {
  return changed
    ? { kind: "success", message: "Clasificación eliminada" }
    : {
        kind: "error",
        message: "No había una clasificación vigente; el movimiento se volvió a cargar",
      };
}

export interface BancoV03LiveProps {
  initialAccountId?: string;
  initialMovementId?: string;
}

export function initialBankSelection({ initialAccountId, initialMovementId }: BancoV03LiveProps): {
  accountId: string;
  movementId: string | null;
} {
  return {
    accountId: initialAccountId?.trim() ?? "",
    movementId: initialMovementId?.trim() || null,
  };
}

export function movementFromResolution(response: MovementResolutionDetailResponse): MovimientoV03 {
  const detail = resolutionDetailFromApi(response);
  const amount = Math.abs(Number(response.movement.amount));
  const signedAmount = response.movement.direction === "credit" ? amount : -amount;
  return {
    id: response.movement.id,
    bankAccountId: response.movement.bank_account_id,
    fecha: response.movement.date,
    glosa: response.movement.description,
    monto: signedAmount,
    moneda: response.movement.currency_code?.trim().toUpperCase() || "S/D",
    esAbono: response.movement.direction === "credit",
    cuenta: `${response.movement.bank_account.bank_name} · ${response.movement.bank_account.account_name}`,
    categoria: detail.classification.canonicalType ?? null,
    estadoConciliacion: detail.reconciliation.status,
    estadoClasificacion: detail.classification.status,
    porConciliar:
      detail.reconciliation.status === "pendiente" || detail.reconciliation.status === "parcial",
  };
}

export function BancoV03Live({ initialAccountId, initialMovementId }: BancoV03LiveProps = {}) {
  const [hoy] = React.useState(() => new Date());
  const [initialSelection] = React.useState(() =>
    initialBankSelection({ initialAccountId, initialMovementId }),
  );
  const [selectedAccountId, setSelectedAccountId] = React.useState(initialSelection.accountId);
  const [selectedMovementId, setSelectedMovementId] = React.useState<string | null>(
    initialSelection.movementId,
  );
  const classificationIntent = React.useRef<{ fingerprint: string; key: string } | null>(null);
  const unclassifyIntents = React.useRef(new Map<string, string>());
  const desde = periodo(new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_ALCANCE - 1), 1));
  const hasta = periodo(hoy);

  const dash = useDashboardSummary();
  const cuentas = useBankAccounts(true);
  const sources = useSourcesStatus();
  React.useEffect(() => {
    if (selectedAccountId && cuentas.data?.items) {
      const exists = cuentas.data.items.some(
        (account) => account.id === selectedAccountId && account.account_type !== "credit_card",
      );
      // Un enlace desde un documento puede apuntar a una cuenta histórica/inactiva que ya no
      // forma parte del selector actual. Conservamos esa cuenta mientras resolvemos el movimiento:
      // el read model agrega una opción explícita y permite auditar su origen.
      if (!exists && !selectedMovementId) {
        setSelectedAccountId("");
        setSelectedMovementId(null);
      }
      return;
    }
    const firstAccountId = cuentas.data?.items?.find(
      (account) => account.active && account.account_type !== "credit_card",
    )?.id;
    if (!selectedAccountId && firstAccountId) {
      setSelectedAccountId(firstAccountId);
    }
  }, [cuentas.data, selectedAccountId, selectedMovementId]);
  const movs = useBankMovements({
    period_from: desde,
    period_to: hasta,
    bank_account_id: selectedAccountId || undefined,
    limit: LIMITE_MOVIMIENTOS,
  });
  const cats = useCanonicalCategories();
  const resolution = useBankMovementResolution(selectedMovementId);
  const financialEventTypes = useFinancialEventTypes();
  const managementAccounts = useManagementAccountsTree();
  const classificationDimensions = useClassificationDimensions(selectedMovementId != null);
  const replaceClassification = useReplaceBankMovementClassification();
  const unclassify = useUnclassifyBankMovement();
  const unreconcile = useRevertReconciliation();

  const categorias = React.useMemo(
    () => new Map((cats.data?.items ?? []).map((c) => [c.code, c.label])),
    [cats.data],
  );
  const resolutionDetails = React.useMemo(() => {
    const result = new Map();
    if (selectedMovementId && resolution.data) {
      result.set(selectedMovementId, resolutionDetailFromApi(resolution.data));
    }
    return result;
  }, [resolution.data, selectedMovementId]);
  const deepLinkedMovement = React.useMemo(
    () => (resolution.data ? movementFromResolution(resolution.data) : null),
    [resolution.data],
  );
  const accountOptions = React.useMemo(
    () => flattenAccounts(managementAccounts.data?.items ?? []),
    [managementAccounts.data],
  );
  const eventOptions = React.useMemo(
    () =>
      (financialEventTypes.data?.items ?? []).map((item) => ({
        code: item.code,
        label: item.code.replaceAll("_", " "),
      })),
    [financialEventTypes.data],
  );
  const dimensionOptions = React.useMemo(
    () =>
      classificationDimensions.data.map(({ dimension, values }) => ({
        id: dimension.id,
        name: dimension.name,
        values: values
          .filter((value) => value.active)
          .map((value) => ({ id: value.id, name: value.name })),
      })),
    [classificationDimensions.data],
  );

  function refreshResolution() {
    void movs.refetch();
    void resolution.refetch();
  }

  const saldoVivo = null;
  const tarjetasVivas = null;
  const sourcesVivas = sources.data?.sources ?? [];

  return (
    <BancoV03View
      summary={dash.data ?? null}
      saldo={saldoVivo}
      tarjetas={tarjetasVivas}
      saldoPorTarjeta={new Map()}
      cuentasQavante={cuentas.data?.items ?? null}
      links={null}
      sources={sourcesVivas}
      movimientos={movs.data?.items ?? null}
      movimientosTotal={movs.data?.total ?? null}
      movimientosMotivo={movs.isError ? motivoSinMovimientos(movs.error) : null}
      categorias={categorias}
      resolutionDetails={resolutionDetails}
      deepLinkedMovement={deepLinkedMovement}
      selectedAccountId={selectedAccountId}
      onAccountChange={(accountId) => {
        setSelectedAccountId(accountId);
        setSelectedMovementId(null);
      }}
      onOpenMovement={setSelectedMovementId}
      onUnreconcile={(movementId) =>
        unreconcile.mutate(movementId, {
          onSuccess: (result) => {
            if (result.reverted > 0) toast.success("Conciliación deshecha");
            else toast.error("No se revirtió ningún vínculo; el movimiento se volvió a cargar");
            refreshResolution();
          },
          onError: (error) => toast.error(mutationErrorMessage(error)),
        })
      }
      onUnclassify={(movementId) =>
        unclassify.mutate(
          {
            movementId,
            idempotencyKey:
              unclassifyIntents.current.get(movementId) ??
              (() => {
                const key = createTreasuryIdempotencyKey("unclassify", movementId);
                unclassifyIntents.current.set(movementId, key);
                return key;
              })(),
          },
          {
            onSuccess: (result) => {
              unclassifyIntents.current.delete(movementId);
              const feedback = unclassifyFeedback(result.changed);
              toast[feedback.kind](feedback.message);
              refreshResolution();
            },
            onError: (error) => toast.error(mutationErrorMessage(error)),
          },
        )
      }
      classificationEditor={
        accountOptions.length > 0 && eventOptions.length > 0
          ? {
              accounts: accountOptions,
              events: eventOptions,
              dimensions: dimensionOptions,
              saving: replaceClassification.isPending,
              onSave: async (body) => {
                if (!selectedMovementId) return;
                const fingerprint = `${selectedMovementId}:${JSON.stringify(body)}`;
                if (classificationIntent.current?.fingerprint !== fingerprint) {
                  classificationIntent.current = {
                    fingerprint,
                    key: createTreasuryIdempotencyKey("classify", selectedMovementId),
                  };
                }
                try {
                  await replaceClassification.mutateAsync({
                    movementId: selectedMovementId,
                    body,
                    idempotencyKey: classificationIntent.current.key,
                  });
                  classificationIntent.current = null;
                  toast.success("Clasificación guardada");
                  refreshResolution();
                } catch (error) {
                  toast.error(
                    unknownErrorToUserMessage(
                      error,
                      "No se pudo guardar la clasificación. Intenta nuevamente.",
                    ),
                  );
                  throw error;
                }
              },
            }
          : undefined
      }
      alcance={`los últimos ${MESES_ALCANCE} meses`}
      cuentasCargando={cuentas.isLoading}
      movimientosCargando={movs.isLoading}
      refrescando={!cuentas.isLoading && cuentas.isFetching}
      hoy={hoy}
    />
  );
}

function flattenAccounts(
  nodes: ManagementAccountNode[],
  depth = 0,
): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => [
    ...(node.active && node.is_visible
      ? [{ id: node.id, label: `${"· ".repeat(depth)}${node.display_name ?? node.name}` }]
      : []),
    ...flattenAccounts(node.children ?? [], depth + 1),
  ]);
}
