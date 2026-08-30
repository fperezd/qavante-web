"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import {
  useConfirmReconciliation,
  useConfirmReconciliationWithDocument,
  useReconciliationReview,
  useDocumentSuggestions,
  useRejectReconciliation,
  useRevertReconciliation,
} from "@/lib/api/reconciliation";
import { useSuggestedCategory } from "@/lib/api/classification-rules";
import { useManagementAccountsTree } from "@/lib/api/management";
import { useBankMovements, useClassifyBankMovement } from "@/lib/api/treasury";
import { toManagementAccountTreeRows } from "@/components/clasificacion/adapters";
import { BandejaV07View } from "./bandeja-v07-view";
import {
  candidatos as adaptarCandidatos,
  itemsClasificar,
  itemsConciliar,
  sugerenciaCategoria,
  type ItemV07,
  type OpcionCuentaV07,
} from "./bandeja-v07-model";

/* Cableado de V07 · Bandeja. La vista es presentacional; acá se resuelven las fuentes, todas
 * VIVAS en el contrato deployado:
 *
 *   · `GET  /api/treasury/reconciliation/review`                      → la carta de conciliar.
 *   · `GET  /api/treasury/reconciliation/{id}/document-suggestions`   → los candidatos con
 *     folio/fecha/monto de AMBOS lados, sólo del ítem que está en pantalla.
 *   · `GET  /api/bank-movements?status=unclassified`                  → la carta de clasificar.
 *   · `GET  /api/bank-movements?status=classified`                    → los 3 frecuentes.
 *   · `GET  /api/treasury/bank-movements/{id}/suggested-category`     → la sugerencia, SÓLO si
 *     una regla activa matchea (devuelve `null` si no: Ley 3, no se infiere nada).
 *   · `GET  /api/management/accounts/tree`                            → el catálogo de categorías.
 *
 * Escrituras: `confirm` (con o sin documento elegido), `reject`, `revert` (el Deshacer de la Ley 5
 * para conciliar) y `classify` — este último también con `create_rule: true` para la oferta de
 * regla, que es como el contrato la crea (§17).
 *
 * LO QUE NO SE CABLEA, Y POR QUÉ: no hay `onDeshacerClasificar`. La reversión genérica de
 * clasificación está implementada pero SIN MERGEAR (`qavante-api#257`); consumirla hoy sería
 * escribir contra un contrato que todavía puede cambiar. Cuando mergee, encenderlo es pasar el
 * handler que la vista ya declara.
 *
 * Los candidatos y la sugerencia se piden SÓLO del ítem visible (una card a la vez), no de la cola
 * entera: pedir N sugerencias para mostrar una es tráfico que el dueño paga en espera. */

const ISSUE_SUCESOR = "#90";
const TOPE_CLASIFICAR = 100;
const TOPE_HISTORIAL = 200;

/** Por qué no llegó una fuente, en lenguaje de dueño. */
export function motivoFuente(err: unknown, que: string): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return `No pudimos conectar con ${que} (error de red). Vuelve a intentar en un momento.`;
  }
  return `${que} no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.`;
}

export function BandejaV07Live({ issueSucesor = ISSUE_SUCESOR }: { issueSucesor?: string }) {
  const [hoy] = React.useState(() => new Date());
  const [activo, setActivo] = React.useState<ItemV07 | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  const review = useReconciliationReview();
  const sinClasificar = useBankMovements({ status: "unclassified", limit: TOPE_CLASIFICAR });
  const historial = useBankMovements({ status: "classified", limit: TOPE_HISTORIAL });
  const arbol = useManagementAccountsTree();

  const idConciliar = activo?.tipo === "conciliar" ? activo.id : null;
  const idClasificar = activo?.tipo === "clasificar" ? activo.id : "";
  const documentos = useDocumentSuggestions(idConciliar);
  const categoria = useSuggestedCategory(idClasificar);

  const confirmar = useConfirmReconciliation();
  const confirmarConDocumento = useConfirmReconciliationWithDocument();
  const descartar = useRejectReconciliation();
  const revertir = useRevertReconciliation();
  const clasificar = useClassifyBankMovement();

  const cuentas: OpcionCuentaV07[] = React.useMemo(() => {
    const filas = toManagementAccountTreeRows(arbol.data?.items ?? []);
    return filas.map((f) => ({ id: f.id, nombre: f.name, seleccionable: f.active }));
  }, [arbol.data]);

  const cuentasPorCodigo = React.useMemo(() => {
    const filas = toManagementAccountTreeRows(arbol.data?.items ?? []);
    return new Map(
      filas.map((f) => [f.code, { id: f.id, nombre: f.name, seleccionable: f.active }] as const),
    );
  }, [arbol.data]);

  if (review.isLoading && sinClasificar.isLoading) return <CargandoBandeja />;

  const itemsC = review.isError ? null : itemsConciliar(review.data);
  const itemsK = sinClasificar.isError ? null : itemsClasificar(sinClasificar.data);

  function fallo(accion: string) {
    return (err: unknown) => {
      setAviso(
        err instanceof ApiError && err.isNetworkError()
          ? `No pudimos ${accion}: se cortó la conexión. El movimiento sigue pendiente; vuelve a intentar.`
          : `No pudimos ${accion}. El movimiento sigue pendiente; vuelve a intentar.`,
      );
      void review.refetch();
      void sinClasificar.refetch();
    };
  }

  return (
    <BandejaV07View
      conciliar={itemsC}
      clasificar={itemsK}
      conciliarMotivo={
        review.isError ? motivoFuente(review.error, "la cola de conciliación") : null
      }
      clasificarMotivo={
        sinClasificar.isError
          ? motivoFuente(sinClasificar.error, "el listado de movimientos del banco")
          : null
      }
      candidatos={
        idConciliar
          ? {
              movimientoId: idConciliar,
              lista: adaptarCandidatos(documentos.data),
              cargando: documentos.isLoading,
              motivo: documentos.isError
                ? "No pudimos traer los documentos candidatos de este movimiento."
                : null,
            }
          : null
      }
      sugerencia={
        idClasificar
          ? {
              movimientoId: idClasificar,
              /* Un error del endpoint de sugerencia NO se muestra como "no hay regla": eso sería
                 afirmar algo que no sabemos. Se deja `null` con `cargando` apagado y la card
                 ofrece el camino manual, que es la verdad disponible. */
              valor: categoria.isError
                ? null
                : sugerenciaCategoria(categoria.data, cuentasPorCodigo),
              cargando: categoria.isLoading,
            }
          : null
      }
      cuentas={cuentas}
      clasificados={historial.data?.items ?? []}
      avisoError={aviso}
      onCerrarAviso={() => setAviso(null)}
      onItemActivo={setActivo}
      onConciliar={(item, documentoId) => {
        setAviso(null);
        if (documentoId) {
          confirmarConDocumento.mutate(
            { movementId: item.id, documentId: documentoId },
            { onError: fallo("conciliar contra el documento que elegiste") },
          );
        } else {
          confirmar.mutate(item.id, { onError: fallo("conciliar este movimiento") });
        }
      }}
      onDeshacerConciliar={(item) => {
        revertir.mutate(item.id, { onError: fallo("deshacer esta conciliación") });
      }}
      onNoEsEsta={(item) => {
        setAviso(null);
        descartar.mutate(item.id, { onError: fallo("descartar esta sugerencia") });
      }}
      onClasificar={(item, cuentaId, notas) => {
        setAviso(null);
        clasificar.mutate(
          {
            movementId: item.id,
            body: {
              management_account_id: cuentaId,
              create_rule: false,
              ...(notas.trim() ? { classification_notes: notas.trim() } : {}),
            },
          },
          { onError: fallo("clasificar este movimiento") },
        );
      }}
      onCrearRegla={(item, cuentaId) => {
        /* §17: la regla se crea DESDE el movimiento con `create_rule: true`. Re-clasificar al
           mismo destino es la forma que el contrato ofrece; no hay endpoint "crear regla desde
           un movimiento ya clasificado". */
        clasificar.mutate(
          { movementId: item.id, body: { management_account_id: cuentaId, create_rule: true } },
          { onError: fallo("crear la regla") },
        );
      }}
      onReintentar={() => {
        setAviso(null);
        void review.refetch();
        void sinClasificar.refetch();
      }}
      issueSucesor={issueSucesor}
      hoy={hoy}
    />
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoBandeja() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos juntando lo que el piloto no resolvió solo: la cola de conciliación y los
        movimientos sin clasificar (~5 s).
      </p>
      <div className="h-14 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
      <div className="h-64 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
