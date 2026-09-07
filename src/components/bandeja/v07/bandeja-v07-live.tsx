"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import {
  useConfirmReconciliation,
  useConfirmReconciliationWithDocument,
  useReconciliationReview,
  useDocumentSuggestions,
  useRejectReconciliationSuggestion,
  useRevertReconciliation,
} from "@/lib/api/reconciliation";
import {
  useCreateClassificationRule,
  useSuggestRuleForMovement,
  useSuggestedCategory,
  type CreateClassificationRuleRequest,
  type SuggestRuleResponse,
} from "@/lib/api/classification-rules";
import { useManagementAccountsTree } from "@/lib/api/management";
import {
  useBankMovements,
  useCanonicalCategories,
  useClassifyBankMovement,
  useClassifyBankMovementsBulk,
  type BulkClassifyMovementRequest,
  type ClassifyMovementRequest,
} from "@/lib/api/treasury";
import {
  ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY,
  useReversibleActions,
  useRevertReversibleAction,
} from "@/lib/api/reversible-actions";
import { toManagementAccountTreeRows } from "@/components/clasificacion/adapters";
import { BandejaV07View } from "./bandeja-v07-view";
import {
  accionesAutoClasificar,
  candidatos as adaptarCandidatos,
  itemsClasificar,
  itemsConciliar,
  sugerenciaCategoria,
  type ItemV07,
  type OpcionCuentaV07,
  type TabV07,
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
 *   · `GET  /api/reversible-actions`                                  → lo que Qavante clasificó
 *     SOLO y todavía se puede deshacer (Ley 5, issue #90).
 *
 * Escrituras: `confirm` (con o sin documento elegido), `reject` con memoria del par cuando la card
 * conoce el documento (API #359, aún pendiente de merge), `revert` (el Deshacer de la Ley 5 para
 * conciliar), `classify`, `classify-bulk` manual y atómico (API #350) y
 * `POST /api/reversible-actions/{action_id}/revert` para lo que Qavante clasificó SOLO. Crear una
 * regla es un flujo separado y verificable: `suggest-rule` (read-only) → `POST classification-rules`.
 *
 * LO QUE SIGUE SIN CABLEARSE, Y POR QUÉ: no hay Deshacer para el `classify` que dispara el botón
 * "Guardar" de la carta. Verificado contra `api/app/core/treasury_repo.py`
 * (`classify_movement`): ese PATCH nunca pasa `auto_action_summary`, así que NUNCA registra una
 * acción reversible — es una decisión del USUARIO, y la Ley 5 cubre lo que Qavante hace SOLO. No
 * es un hueco pendiente de un contrato futuro: es el contrato tal como quedó.
 *
 * Los candidatos y la sugerencia se piden SÓLO del ítem visible (una card a la vez), no de la cola
 * entera: pedir N sugerencias para mostrar una es tráfico que el dueño paga en espera. La bitácora
 * de auto-clasificación, en cambio, es tenant-wide (no hay forma de acotarla a un movimiento —
 * `GET /api/reversible-actions` no filtra por eso) y se pide siempre, sea cual sea el tab activo:
 * es un volumen chico (acotado a `bank_movement.auto_classify` + `only_undoable`) y cambiar de tab
 * no debería disparar un fetch nuevo. */

const ISSUE_SUCESOR = "#90";
const TOPE_CLASIFICAR = 100;
const TOPE_HISTORIAL = 200;
/** El banner muestra sólo la más reciente + un conteo del resto (ver `BitacoraAutoClasificar`);
 *  este tope es de tráfico, no de UI — de sobra para lo que un tenant genera en 7 días. */
const TOPE_AUTO_CLASIFICAR = 20;

type ReferenciaItemActivo = Pick<ItemV07, "id" | "tipo">;

/** Selecciona sólo movimientos que todavía siguen en la cola de clasificación. */
export function referenciaMovimientoInicial(
  items: readonly ItemV07[] | null,
  movimientoInicial?: string,
): ReferenciaItemActivo | null {
  if (!movimientoInicial || !items) return null;
  const movimiento = items.find((item) => item.id === movimientoInicial);
  return movimiento ? { id: movimiento.id, tipo: movimiento.tipo } : null;
}

/** Por qué no llegó una fuente, en lenguaje de dueño. */
export function motivoFuente(err: unknown, que: string): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return `No pudimos conectar con ${que} (error de red). Vuelve a intentar en un momento.`;
  }
  return `${que} no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.`;
}

/** Payload completo: una decisión manual en Bandeja nunca queda `partially_classified`. */
export function cuerpoClasificacion(
  cuentaId: string,
  categoriaCanonica: string,
  notas: string,
  createRule: boolean,
): ClassifyMovementRequest {
  return {
    management_account_id: cuentaId,
    canonical_category: categoriaCanonica as ClassifyMovementRequest["canonical_category"],
    create_rule: createRule,
    ...(notas.trim() ? { classification_notes: notas.trim() } : {}),
  };
}

/** Payload atómico e idempotente del lote, con las mismas dos dimensiones obligatorias. */
export function cuerpoClasificacionLote(
  movementIds: string[],
  cuentaId: string,
  categoriaCanonica: string,
  notas: string,
  idempotencyKey: string,
): BulkClassifyMovementRequest {
  return {
    movement_ids: movementIds,
    management_account_id: cuentaId,
    canonical_category: categoriaCanonica as BulkClassifyMovementRequest["canonical_category"],
    ...(notas.trim() ? { classification_notes: notas.trim() } : {}),
    idempotency_key: idempotencyKey,
  };
}

function textoObligatorio(propuesta: SuggestRuleResponse, campo: string): string {
  const valor = propuesta[campo];
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`La propuesta de regla no trajo ${campo}.`);
  }
  return valor.trim();
}

/** Convierte la propuesta canónica del backend en una creación explícita y confirmable. */
export function cuerpoReglaDesdePropuesta(
  propuesta: SuggestRuleResponse,
  cuentaId: string,
  categoriaCanonica: string,
): CreateClassificationRuleRequest {
  return {
    name: textoObligatorio(propuesta, "name"),
    source_type: textoObligatorio(propuesta, "source_type"),
    condition_field: textoObligatorio(propuesta, "condition_field"),
    operator: textoObligatorio(propuesta, "operator"),
    condition_value: textoObligatorio(propuesta, "condition_value"),
    management_account_id: cuentaId,
    canonical_category:
      categoriaCanonica as CreateClassificationRuleRequest["canonical_category"],
    priority: typeof propuesta.priority === "number" ? propuesta.priority : 10,
    confidence: typeof propuesta.confidence === "number" ? propuesta.confidence : 1,
  };
}

export function BandejaV07Live({
  issueSucesor = ISSUE_SUCESOR,
  tabInicial,
  movimientoInicial,
}: {
  issueSucesor?: string;
  /** Conserva la intención al entrar por las rutas clásicas. */
  tabInicial?: TabV07;
  /** Abre el movimiento pedido por un enlace clásico, si todavía está pendiente. */
  movimientoInicial?: string;
}) {
  const [hoy] = React.useState(() => new Date());
  /* Guardamos la identidad, no el objeto que deriva cada query. Las respuestas de React Query
     pueden traer una referencia nueva aunque el contenido sea el mismo: guardar ese objeto haría
     que una ruta clásica con `?movimiento=` se reabra en cada render. */
  const [activoRef, setActivoRef] = React.useState<ReferenciaItemActivo | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  const review = useReconciliationReview();
  const sinClasificar = useBankMovements({ status: "unclassified", limit: TOPE_CLASIFICAR });
  const historial = useBankMovements({ status: "classified", limit: TOPE_HISTORIAL });
  const arbol = useManagementAccountsTree();
  const categoriasCanonicas = useCanonicalCategories();
  const autoClasificadas = useReversibleActions({
    actionType: ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY,
    onlyUndoable: true,
    limit: TOPE_AUTO_CLASIFICAR,
  });

  const confirmar = useConfirmReconciliation();
  const confirmarConDocumento = useConfirmReconciliationWithDocument();
  const descartar = useRejectReconciliationSuggestion();
  const revertir = useRevertReconciliation();
  const clasificar = useClassifyBankMovement();
  const clasificarLote = useClassifyBankMovementsBulk();
  const sugerirRegla = useSuggestRuleForMovement();
  const crearRegla = useCreateClassificationRule();
  const revertirAuto = useRevertReversibleAction();
  /* Una respuesta de red perdida se reintenta con la MISMA llave para la misma decisión. Si cambia
     ids, cuenta o nota, cambia el fingerprint y por tanto nace una intención nueva. */
  const llavesLote = React.useRef(new Map<string, string>());

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

  const itemsC = React.useMemo(
    () => (review.isError ? null : itemsConciliar(review.data)),
    [review.data, review.isError],
  );
  const itemsK = React.useMemo(
    () => (sinClasificar.isError ? null : itemsClasificar(sinClasificar.data)),
    [sinClasificar.data, sinClasificar.isError],
  );
  const activo = React.useMemo(() => {
    if (!activoRef) return null;
    const items = activoRef.tipo === "conciliar" ? itemsC : itemsK;
    return items?.find((item) => item.id === activoRef.id) ?? null;
  }, [activoRef, itemsC, itemsK]);

  const idConciliar = activo?.tipo === "conciliar" ? activo.id : null;
  const idClasificar = activo?.tipo === "clasificar" ? activo.id : "";
  const documentos = useDocumentSuggestions(idConciliar);
  const categoria = useSuggestedCategory(idClasificar);

  React.useEffect(() => {
    const movimiento = referenciaMovimientoInicial(itemsK, movimientoInicial);
    if (!movimiento) return;
    setActivoRef((anterior) =>
      anterior?.id === movimiento.id && anterior.tipo === movimiento.tipo ? anterior : movimiento,
    );
  }, [itemsK, movimientoInicial]);

  if (review.isLoading && sinClasificar.isLoading) return <CargandoBandeja />;

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
      conciliarTotal={review.data?.count ?? null}
      clasificar={itemsK}
      clasificarTotal={sinClasificar.data?.total ?? null}
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
      categoriasCanonicas={categoriasCanonicas.data?.items ?? []}
      categoriasCanonicasCargando={categoriasCanonicas.isLoading}
      categoriasCanonicasMotivo={
        categoriasCanonicas.isError
          ? motivoFuente(categoriasCanonicas.error, "los tipos de movimiento")
          : null
      }
      clasificados={historial.data?.items ?? []}
      autoClasificadas={
        autoClasificadas.isError ? null : accionesAutoClasificar(autoClasificadas.data)
      }
      autoClasificadasMotivo={
        autoClasificadas.isError
          ? motivoFuente(autoClasificadas.error, "lo que Qavante clasificó solo")
          : null
      }
      avisoError={aviso}
      onCerrarAviso={() => setAviso(null)}
      onItemActivo={(item) => setActivoRef(item ? { id: item.id, tipo: item.tipo } : null)}
      onConciliar={async (item, documentoId) => {
        setAviso(null);
        try {
          if (documentoId) {
            await confirmarConDocumento.mutateAsync({
              movementId: item.id,
              documentId: documentoId,
            });
          } else {
            await confirmar.mutateAsync(item.id);
          }
        } catch (err) {
          fallo(
            documentoId
              ? "conciliar contra el documento que elegiste"
              : "conciliar este movimiento",
          )(err);
          throw err;
        }
      }}
      onDeshacerConciliar={(item) => {
        revertir.mutate(item.id, { onError: fallo("deshacer esta conciliación") });
      }}
      onNoEsEsta={async (item, candidato) => {
        setAviso(null);
        try {
          await descartar.mutateAsync({
            movementId: item.id,
            documentId: candidato?.documentId ?? null,
          });
        } catch (err) {
          fallo("descartar esta sugerencia")(err);
          throw err;
        }
      }}
      onClasificar={async (item, cuentaId, categoriaCanonica, notas) => {
        setAviso(null);
        try {
          await clasificar.mutateAsync({
            movementId: item.id,
            body: cuerpoClasificacion(cuentaId, categoriaCanonica, notas, false),
          });
        } catch (err) {
          fallo("clasificar este movimiento")(err);
          throw err;
        }
      }}
      onClasificarLote={async (movementIds, cuentaId, categoriaCanonica, notas) => {
        setAviso(null);
        const ordenados = [...movementIds].sort();
        const fingerprint = JSON.stringify({
          movementIds: ordenados,
          cuentaId,
          categoriaCanonica,
          notas,
        });
        let idempotencyKey = llavesLote.current.get(fingerprint);
        if (!idempotencyKey) {
          idempotencyKey = crypto.randomUUID();
          llavesLote.current.set(fingerprint, idempotencyKey);
        }
        try {
          await clasificarLote.mutateAsync(
            cuerpoClasificacionLote(ordenados, cuentaId, categoriaCanonica, notas, idempotencyKey),
          );
          llavesLote.current.delete(fingerprint);
        } catch (err) {
          fallo("clasificar este lote")(err);
          throw err;
        }
      }}
      onCrearRegla={async (item, cuentaId, categoriaCanonica) => {
        setAviso(null);
        try {
          const propuesta = await sugerirRegla.mutateAsync(item.id);
          await crearRegla.mutateAsync(
            cuerpoReglaDesdePropuesta(propuesta, cuentaId, categoriaCanonica),
          );
        } catch (err) {
          setAviso(
            err instanceof ApiError && err.isNetworkError()
              ? "La clasificación quedó guardada, pero no pudimos crear la regla porque se cortó la conexión. La oferta sigue disponible para reintentar."
              : "La clasificación quedó guardada, pero la regla no se creó. La oferta sigue disponible para reintentar.",
          );
          throw err;
        }
      }}
      onDeshacerAutoClasificar={(accion) => revertirAuto.mutateAsync(accion.actionId)}
      onReintentar={() => {
        setAviso(null);
        void review.refetch();
        void sinClasificar.refetch();
        void categoriasCanonicas.refetch();
        void autoClasificadas.refetch();
      }}
      issueSucesor={issueSucesor}
      hoy={hoy}
      tabInicial={tabInicial}
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
