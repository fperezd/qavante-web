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
import { BUSINESS_TIME_ZONE } from "@/lib/formatters/date";
import { MESES_LARGOS } from "@/lib/formatters/months";
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
 *   · `GET /api/bank-movements` (3 meses calendario) — los movimientos con su ciclo de vida;
 *   · `GET /api/treasury/canonical-categories`     — la etiqueta humana de cada categoría.
 *
 * Nada bloquea la pantalla entera: cada sección degrada a su propio "sin dato" con motivo. */

/** `YYYY-MM` del mes de negocio de un instante.
 *
 *  `getFullYear()/getMonth()` daban el mes del NAVEGADOR. El último día de cada mes chileno,
 *  entre las 21:00 y las 24:00, el día en UTC ya es el 1 del mes siguiente, así que la ventana
 *  saltaba un mes entero. El mes se mira desde Chile, igual que el día de negocio de la API. */
function periodo(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

/** El alcance REAL de la cartola, nombrado por sus meses: "agosto a octubre de 2026".
 *
 *  La pantalla decía "los últimos 3 meses" (B17). No lo son: `/api/bank-movements` filtra por
 *  MES CALENDARIO (`period_from`/`period_to` son `YYYY-MM`; `treasury_repo.list_movements` arma
 *  el rango `[1 de period_from, fin de period_to]`), así que el 6 de octubre la ventana empieza
 *  el **1 de agosto** y son dos meses y seis días, no noventa.
 *
 *  La cuenta en dólares lo delató: le faltaban los movimientos del 10 y del 17 de julio, que
 *  "los últimos 3 meses" promete y la ventana nunca incluyó. En la cuenta en pesos no se notaba
 *  porque hay movimientos todos los días y ninguno falta a la vista.
 *
 *  De las dos salidas posibles —noventa días corridos de verdad, o un texto que diga qué cubre—
 *  se toma la segunda: el contrato de la API es mensual y no expresa un rango por día, así que
 *  noventa días corridos exigiría una superficie nueva. El texto ahora nombra lo que hay. */
export function alcanceDeLaCartola(desde: string, hasta: string): string {
  const a = desde.split("-").map(Number);
  const b = hasta.split("-").map(Number);
  const ya = Number(a[0]);
  const yb = Number(b[0]);
  const primero = MESES_LARGOS[Number(a[1]) - 1];
  const ultimo = MESES_LARGOS[Number(b[1]) - 1];
  if (ya !== yb) return `${primero} de ${ya} a ${ultimo} de ${yb}`;
  return `${primero} a ${ultimo} de ${yb}`;
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
    /* La contraparte sale del detalle publicado por movimiento, no de la glosa. */
    contraparte: detail.contraparte,
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
  const mesActual = periodo(hoy);
  const movs = useBankMovements({
    period_from: desde,
    period_to: hasta,
    bank_account_id: selectedAccountId || undefined,
    limit: LIMITE_MOVIMIENTOS,
  });
  const movsMes = useBankMovements({
    period_from: mesActual,
    period_to: mesActual,
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
    void movsMes.refetch();
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
      movimientosMes={movsMes.data?.items ?? null}
      movimientosMesMotivo={movsMes.isError ? motivoSinMovimientos(movsMes.error) : null}
      movimientosMesCargando={movsMes.isLoading}
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
      alcance={alcanceDeLaCartola(desde, hasta)}
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
