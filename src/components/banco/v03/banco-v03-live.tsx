"use client";

import * as React from "react";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  useBankAccounts,
  useBankMovements,
  useBiceAccounts,
  useBiceSaldo,
  useBiceTarjetas,
  useBiceTarjetasSaldos,
  useCanonicalCategories,
  useBankMovementResolution,
  useFinancialEventTypes,
  useReplaceBankMovementClassification,
  useUnclassifyBankMovement,
  createTreasuryIdempotencyKey,
} from "@/lib/api/treasury";
import { useRevertReconciliation } from "@/lib/api/reconciliation";
import {
  useClassificationDimensions,
  useManagementAccountsTree,
  type ManagementAccountNode,
} from "@/lib/api/management";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { ApiError } from "@/lib/api/errors";
import { toast } from "sonner";
import { BancoV03View } from "./banco-v03-view";
import { resolutionDetailFromApi } from "./bank-resolution-detail-model";

/* Cableado de V03 · Banco. La vista es presentacional; acá se resuelven las fuentes:
 *
 *   · `GET /api/dashboard/summary`               — "Caja hoy" vía `cajaHoy()` (la MISMA fuente que V01/V02);
 *   · `GET /api/bice/saldo` + `/tarjetas` (+ saldo por tarjeta) — saldos y cupos que el banco informa en vivo;
 *   · `GET /api/treasury/bank-accounts?active=false` — las cuentas Qavante (filas cuando bice no
 *     responde; moneda y etiqueta de cada movimiento);
 *   · `GET /api/bank-movements/bice/accounts`     — el vínculo cuenta bice ↔ cuenta Qavante;
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

export function BancoV03Live() {
  const [hoy] = React.useState(() => new Date());
  const [selectedAccountId, setSelectedAccountId] = React.useState("");
  const [selectedMovementId, setSelectedMovementId] = React.useState<string | null>(null);
  const classificationIntent = React.useRef<{ fingerprint: string; key: string } | null>(null);
  const unclassifyIntents = React.useRef(new Map<string, string>());
  const desde = periodo(new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_ALCANCE - 1), 1));
  const hasta = periodo(hoy);

  const dash = useDashboardSummary();
  const saldo = useBiceSaldo();
  const tarjetas = useBiceTarjetas();
  const ops = React.useMemo(
    () => (tarjetas.data?.data ?? []).map((t) => t.operationNumber),
    [tarjetas.data],
  );
  const { saldoPorTarjeta } = useBiceTarjetasSaldos(ops, ops.length > 0);
  const cuentas = useBankAccounts(true);
  const links = useBiceAccounts();
  const sources = useSourcesStatus();
  React.useEffect(() => {
    const firstAccountId = cuentas.data?.items?.find(
      (account) => account.active && account.account_type !== "credit_card",
    )?.id;
    if (!selectedAccountId && firstAccountId) {
      setSelectedAccountId(firstAccountId);
    }
  }, [cuentas.data, selectedAccountId]);
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

  return (
    <BancoV03View
      summary={dash.data ?? null}
      saldo={saldo.data ?? null}
      tarjetas={tarjetas.data ?? null}
      saldoPorTarjeta={saldoPorTarjeta}
      cuentasQavante={cuentas.data?.items ?? null}
      links={links.data?.accounts ?? null}
      sources={sources.data?.sources ?? null}
      movimientos={movs.data?.items ?? null}
      movimientosTotal={movs.data?.total ?? null}
      movimientosMotivo={movs.isError ? motivoSinMovimientos(movs.error) : null}
      categorias={categorias}
      resolutionDetails={resolutionDetails}
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
          onError: (error) => toast.error(error.message),
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
            onError: (error) => toast.error(error.message),
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
                  toast.error(error instanceof Error ? error.message : "No se pudo clasificar");
                  throw error;
                }
              },
            }
          : undefined
      }
      alcance={`los últimos ${MESES_ALCANCE} meses`}
      cuentasCargando={saldo.isLoading || cuentas.isLoading}
      movimientosCargando={movs.isLoading}
      refrescando={!saldo.isLoading && (saldo.isFetching || tarjetas.isFetching)}
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
