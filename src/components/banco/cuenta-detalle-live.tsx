"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  createTreasuryIdempotencyKey,
  useBankMovementResolution,
  useBankAccounts,
  useBankMovements,
  useFinancialEventTypes,
  useReplaceBankMovementClassification,
  useUnclassifyBankMovement,
  treasuryKeys,
  BANK_MOVEMENTS_LIMIT_MAX,
} from "@/lib/api/treasury";
import { useMyPermissions } from "@/lib/api/users";
import { hasPermission } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { unknownErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useReconciliationReview,
  useConfirmReconciliation,
  useConfirmReconciliationBatch,
  useConfirmReconciliationWithDocument,
  useRejectReconciliation,
  useRevertReconciliation,
} from "@/lib/api/reconciliation";
import {
  useClassificationDimensions,
  useManagementAccountsTree,
  type ManagementAccountNode,
} from "@/lib/api/management";
import { interpretarErrorConciliar } from "@/components/caja/conciliacion/reconciliacion-cola-map";
import { DocumentSuggestionsDialog } from "@/components/caja/conciliacion/document-suggestions-dialog";
import { MovimientosDetalle, type AccionConciliar } from "./movimientos-detalle";
import { BankResolutionDetailDrawer } from "./v03/bank-resolution-detail-drawer";
import {
  resolutionDetailFromApi,
  resolutionDetailFromMovement,
} from "./v03/bank-resolution-detail-model";
import {
  contraparteDe,
  estadoClasificacionDe,
  estadoConciliacionDe,
  quedaPorConciliar,
  type MovimientoV03,
} from "./v03/banco-v03-model";
import { movimientosDeCuenta, mapaSugerencias } from "./banco-movimientos-model";

/* Detalle de una cuenta: sus movimientos por mes. Fuente = `/api/bank-movements`
   filtrado por `bank_account_id` (el id de la URL). `mesActual` lo calcula el server (Santiago).

   Fase 2 (`conciliarEnabled`, flag `bancoConciliacion`): trae la cola de conciliación (`review`) y
   ofrece el match propuesto de cada movimiento por conciliar + confirmar / rechazar. La cola es
   global; la cruzamos por `movement_id` con los movimientos de ESTA cuenta. */

export function CuentaDetalleLive({
  numeroCuenta,
  mesActual,
  conciliarEnabled = false,
}: {
  numeroCuenta: string;
  mesActual: string;
  conciliarEnabled?: boolean;
}) {
  const [period, setPeriod] = React.useState(mesActual);
  const [selectedMovementId, setSelectedMovementId] = React.useState<string | null>(null);
  const [documentPickerOpen, setDocumentPickerOpen] = React.useState(false);
  const classificationIntent = React.useRef<{ fingerprint: string; key: string } | null>(null);
  const unclassifyIntents = React.useRef(new Map<string, string>());
  const qc = useQueryClient();

  const accountsQuery = useBankAccounts(true);
  const cuenta = accountsQuery.data?.items?.find((item) => item.id === numeroCuenta);
  const bankAccountId = cuenta?.id ?? numeroCuenta;
  const bankQuery = useBankMovements({
    period,
    bank_account_id: bankAccountId ?? undefined,
    limit: BANK_MOVEMENTS_LIMIT_MAX,
  });
  const permissionsQuery = useMyPermissions();
  const canWrite =
    conciliarEnabled && hasPermission(permissionsQuery.data?.permissions, "financial.write");
  const resolutionQuery = useBankMovementResolution(selectedMovementId);
  const financialEventTypes = useFinancialEventTypes();
  const managementAccounts = useManagementAccountsTree();
  const classificationDimensions = useClassificationDimensions(selectedMovementId != null);
  const replaceClassification = useReplaceBankMovementClassification();
  const unclassify = useUnclassifyBankMovement();
  const unreconcile = useRevertReconciliation();
  const confirmWithDocument = useConfirmReconciliationWithDocument();

  const movimientos = React.useMemo(
    () => movimientosDeCuenta(bankQuery.data?.items ?? [], bankAccountId),
    [bankQuery.data, bankAccountId],
  );
  const selectedRawMovement = React.useMemo(
    () => (bankQuery.data?.items ?? []).find((item) => item.id === selectedMovementId) ?? null,
    [bankQuery.data, selectedMovementId],
  );
  const selectedListMovement = React.useMemo(
    () => movimientos.find((item) => item.id === selectedMovementId) ?? null,
    [movimientos, selectedMovementId],
  );
  const selectedMovement = React.useMemo<MovimientoV03 | null>(() => {
    if (!selectedRawMovement || !selectedListMovement) return null;
    return {
      id: selectedRawMovement.id,
      bankAccountId: selectedRawMovement.bank_account_id,
      fecha: selectedListMovement.fecha,
      glosa: selectedListMovement.glosa,
      /* Del CAMPO del movimiento crudo, con su procedencia. Nunca de la glosa. */
      contraparte: contraparteDe(selectedRawMovement),
      monto: selectedListMovement.monto,
      moneda: selectedListMovement.moneda,
      esAbono: selectedListMovement.esAbono,
      cuenta: cuenta ? `${cuenta.bank_name} · ${cuenta.name}` : "Banco",
      categoria: selectedRawMovement.canonical_category ?? null,
      estadoConciliacion: estadoConciliacionDe(selectedRawMovement),
      estadoClasificacion: estadoClasificacionDe(selectedRawMovement),
      porConciliar: quedaPorConciliar(selectedRawMovement),
    };
  }, [cuenta, selectedListMovement, selectedRawMovement]);
  const selectedDetail = React.useMemo(() => {
    if (resolutionQuery.data) return resolutionDetailFromApi(resolutionQuery.data);
    if (selectedRawMovement) {
      return resolutionDetailFromMovement(
        selectedRawMovement,
        selectedRawMovement.canonical_category ?? null,
      );
    }
    return null;
  }, [resolutionQuery.data, selectedRawMovement]);
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

  // Fase 2: cola de conciliación (solo si el flag está ON). Cruzamos por movement_id.
  const reviewQuery = useReconciliationReview(canWrite);
  const confirmar = useConfirmReconciliation();
  const confirmarLote = useConfirmReconciliationBatch();
  const rechazar = useRejectReconciliation();
  const sugerencias = React.useMemo(
    () => mapaSugerencias(reviewQuery.data?.items),
    [reviewQuery.data],
  );
  const [accionEnCurso, setAccionEnCurso] = React.useState<AccionConciliar | null>(null);

  const refrescarMovimientos = React.useCallback(() => {
    // Tras conciliar/rechazar, el estado del movimiento cambió → refrescar movimientos + cola.
    qc.invalidateQueries({ queryKey: treasuryKeys.all });
    reviewQuery.refetch();
    void resolutionQuery.refetch();
  }, [qc, resolutionQuery, reviewQuery]);

  const manejarError = React.useCallback(
    (err: unknown) => {
      const { yaNoEnRevision, mensaje } = interpretarErrorConciliar(err);
      if (yaNoEnRevision) {
        toast.warning(mensaje);
        reviewQuery.refetch(); // la cola quedó vieja → traé la real
      } else {
        toast.error(mensaje);
      }
    },
    [reviewQuery],
  );

  const onConciliar = React.useCallback(
    (movId: string) => {
      setAccionEnCurso({ movId, tipo: "conciliar" });
      confirmar.mutate(movId, {
        onSuccess: () => {
          toast.success("Conciliado.");
          refrescarMovimientos();
        },
        onError: manejarError,
        onSettled: () => setAccionEnCurso(null),
      });
    },
    [confirmar, manejarError, refrescarMovimientos],
  );

  const onRechazar = React.useCallback(
    (movId: string) => {
      setAccionEnCurso({ movId, tipo: "rechazar" });
      rechazar.mutate(movId, {
        onSuccess: () => {
          toast.success("Descartado. El movimiento queda sin conciliar.");
          refrescarMovimientos();
        },
        onError: manejarError,
        onSettled: () => setAccionEnCurso(null),
      });
    },
    [rechazar, manejarError, refrescarMovimientos],
  );

  const onConciliarLote = React.useCallback(
    (movementIds: string[]) => {
      confirmarLote.mutate(movementIds, {
        onSuccess: (result) => {
          if (result.confirmed > 0)
            toast.success(`${result.confirmed} conciliaciones confirmadas.`);
          if (result.failed > 0)
            toast.warning(`${result.failed} propuestas cambiaron y requieren revisión.`);
          refrescarMovimientos();
        },
        onError: manejarError,
      });
    },
    [confirmarLote, manejarError, refrescarMovimientos],
  );

  const loading = bankQuery.isLoading || (accountsQuery.isLoading && !cuenta);
  const actualizando = bankQuery.isFetching || accountsQuery.isFetching;
  const horaTexto =
    bankQuery.dataUpdatedAt > 0
      ? new Date(bankQuery.dataUpdatedAt).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <>
      <MovimientosDetalle
        titulo={cuenta?.name ?? "Cuenta"}
        subtitulo={cuenta ? `${cuenta.bank_name} · ${cuenta.currency_code}` : "Banco"}
        mesActual={mesActual}
        period={period}
        onPeriodChange={(nextPeriod) => {
          setSelectedMovementId(null);
          setDocumentPickerOpen(false);
          setPeriod(nextPeriod);
        }}
        movimientos={movimientos}
        conEstado
        loading={loading}
        actualizando={actualizando}
        error={bankQuery.error}
        horaTexto={horaTexto}
        conciliarEnabled={canWrite}
        sugerencias={sugerencias}
        onConciliar={canWrite ? onConciliar : undefined}
        onRechazar={canWrite ? onRechazar : undefined}
        onConciliarLote={canWrite ? onConciliarLote : undefined}
        loteEnCurso={confirmarLote.isPending}
        accionEnCurso={accionEnCurso}
        onOpenMovement={
          conciliarEnabled ? (movement) => setSelectedMovementId(movement.id ?? null) : undefined
        }
      />
      {selectedMovement && selectedDetail && (
        <BankResolutionDetailDrawer
          open={!documentPickerOpen}
          movement={selectedMovement}
          detail={selectedDetail}
          resolutionLoading={resolutionQuery.isLoading}
          resolutionError={resolutionQuery.error}
          onRetryResolution={() => resolutionQuery.refetch()}
          onClose={() => {
            setSelectedMovementId(null);
            setDocumentPickerOpen(false);
          }}
          onReconcile={
            canWrite &&
            !resolutionQuery.isLoading &&
            !resolutionQuery.isError &&
            selectedMovement.porConciliar
              ? () => setDocumentPickerOpen(true)
              : undefined
          }
          onUnreconcile={
            canWrite &&
            !resolutionQuery.isLoading &&
            !resolutionQuery.isError &&
            selectedDetail.reconciliation.canUnreconcile
              ? () =>
                  unreconcile.mutate(selectedMovement.id, {
                    onSuccess: (result) => {
                      if (result.reverted > 0) toast.success("Conciliación deshecha");
                      else toast.error("No se revirtió ningún vínculo; el movimiento se recargó");
                      refrescarMovimientos();
                    },
                    onError: (error) => toast.error(unknownErrorToUserMessage(error)),
                  })
              : undefined
          }
          onUnclassify={
            canWrite && !resolutionQuery.isLoading && !resolutionQuery.isError
              ? () =>
                  unclassify.mutate(
                    {
                      movementId: selectedMovement.id,
                      idempotencyKey:
                        unclassifyIntents.current.get(selectedMovement.id) ??
                        (() => {
                          const key = createTreasuryIdempotencyKey(
                            "unclassify",
                            selectedMovement.id,
                          );
                          unclassifyIntents.current.set(selectedMovement.id, key);
                          return key;
                        })(),
                    },
                    {
                      onSuccess: (result) => {
                        unclassifyIntents.current.delete(selectedMovement.id);
                        toast[result.changed ? "success" : "error"](
                          result.changed
                            ? "Clasificación eliminada"
                            : "No había una clasificación vigente; el movimiento se recargó",
                        );
                        refrescarMovimientos();
                      },
                      onError: (error) => toast.error(unknownErrorToUserMessage(error)),
                    },
                  )
              : undefined
          }
          classificationEditor={
            canWrite &&
            !resolutionQuery.isLoading &&
            !resolutionQuery.isError &&
            accountOptions.length > 0 &&
            eventOptions.length > 0
              ? {
                  accounts: accountOptions,
                  events: eventOptions,
                  dimensions: dimensionOptions,
                  saving: replaceClassification.isPending,
                  onSave: async (body) => {
                    const fingerprint = `${selectedMovement.id}:${JSON.stringify(body)}`;
                    if (classificationIntent.current?.fingerprint !== fingerprint) {
                      classificationIntent.current = {
                        fingerprint,
                        key: createTreasuryIdempotencyKey("classify", selectedMovement.id),
                      };
                    }
                    try {
                      await replaceClassification.mutateAsync({
                        movementId: selectedMovement.id,
                        body,
                        idempotencyKey: classificationIntent.current.key,
                      });
                      classificationIntent.current = null;
                      toast.success("Clasificación guardada");
                      refrescarMovimientos();
                    } catch (error) {
                      toast.error(
                        error instanceof ApiError
                          ? unknownErrorToUserMessage(error)
                          : "No se pudo guardar la clasificación. Intenta nuevamente.",
                      );
                      throw error;
                    }
                  },
                }
              : undefined
          }
        />
      )}
      <DocumentSuggestionsDialog
        movementId={selectedMovementId}
        currencyCode={selectedMovement?.moneda ?? null}
        open={canWrite && documentPickerOpen}
        onOpenChange={setDocumentPickerOpen}
        choosing={confirmWithDocument.isPending}
        onReturnToDetail={() => setDocumentPickerOpen(false)}
        onChoose={async (documentId) => {
          if (!selectedMovementId) return;
          try {
            await confirmWithDocument.mutateAsync({
              movementId: selectedMovementId,
              documentId,
            });
            toast.success("Conciliado con el documento seleccionado.");
            setDocumentPickerOpen(false);
            refrescarMovimientos();
          } catch (error) {
            manejarError(error);
          }
        }}
      />
    </>
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
