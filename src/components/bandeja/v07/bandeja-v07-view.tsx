"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatters/clp";
import { concordar, formatCount } from "@/lib/formatters/count";
import { formatDateLong, formatRelative } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { Pill } from "@/components/rediseno/pill";
import {
  RedisenoToastProvider,
  useRedisenoToast,
  type RedisenoToast,
} from "@/components/rediseno/toast";
import {
  agruparAlFrente,
  candidatoElegido,
  evidenciaConciliar,
  faltaParaGuardar,
  frecuentes,
  bloqueoConciliar,
  haySugerenciaConciliar,
  interpretarDeshacer,
  lote,
  textoResuelto,
  verboDireccion,
  verboDireccionPlural,
  type MontoMonedaV07,
  parcialidad,
  primerRutEnTexto,
  progreso,
  rumboPendiente,
  trasResolver,
  trasSaltar,
  type AccionAutoClasificarV07,
  type CandidatoV07,
  type ItemClasificarV07,
  type ItemConciliarV07,
  type ItemV07,
  type OpcionCuentaV07,
  type SugerenciaCategoriaV07,
  type TabV07,
} from "./bandeja-v07-model";
import { categoriasParaDireccion } from "@/components/clasificacion/canonical-direction";
import type {
  BankMovement,
  CanonicalCategoryMeta,
  MovimientosDeCuentasRetiradas,
} from "@/lib/api/treasury";
import type { RevertActionResponse } from "@/lib/api/reversible-actions";

/* V07 · Bandeja de excepciones — "sólo lo que el piloto no resolvió solo" (Fase 2, issue #71).
 *
 * PRESENTACIONAL: entran los ítems ya adaptados y salen dos cartas; el cableado vive en
 * `bandeja-v07-live.tsx`. El estado propio es de flujo (qué tab, qué ítem, qué se resolvió en esta
 * sesión), no de datos.
 *
 * ── EL ALCANCE DE ESTA ENTREGA, ESCRITO DONDE SE PUEDE VERIFICAR ────────────────────────────
 * La Ley 5 ("todo lo automático deja bitácora con Deshacer, 7 días") toca esta vista, y las dos
 * cartas la cumplen — pero NO de la misma forma, y la diferencia es a propósito (issue #90):
 *
 *   · CONCILIAR — el toast del "Sí, conciliar" que el propio dueño acaba de apretar lleva
 *     Deshacer de verdad: `POST /api/treasury/reconciliation/{movement_id}/revert` desasigna el
 *     match aplicado, restaura el `outstanding` del documento y libera el movimiento.
 *   · CLASIFICAR — el toast del "Guardar" que el dueño acaba de apretar NUNCA lleva Deshacer, y
 *     eso es CORRECTO, no un hueco: verificado contra `api/app/core/treasury_repo.py`
 *     (`classify_movement`), el `PATCH .../classify` que dispara ese botón no registra ninguna
 *     acción reversible — sólo lo hacen los automatismos por LOTE (`apply-rules`,
 *     `classify-reconciled`), porque la Ley 5 es literal en el propio backend: cubre lo que
 *     Qavante hace SOLO, no lo que el usuario decide. Lo que SÍ se conectó (`qavante-api#257`,
 *     mergeado, patrón genérico ADR-0113) es la bitácora de esos dos automatismos: la carta
 *     muestra, arriba de la card, lo que Qavante clasificó solo y todavía se puede deshacer
 *     (`GET /api/reversible-actions` + `POST /api/reversible-actions/{action_id}/revert`) — y
 *     deshacerlo devuelve el movimiento a "sin clasificar", de vuelta a esta misma carta.
 *
 * El Deshacer de esa bitácora puede negarse por DOS motivos que la UI distingue (no los colapsa
 * en un "no se pudo" genérico — sería el default plausible que la política prohíbe):
 * `estado_derivado` (el dueño reclasificó a mano después; no se tocó nada y NO es reintentable —
 * su cambio manual sigue en pie) y `estado_bloqueado` (otra operación tiene la fila tomada AHORA;
 * no se tocó nada y SÍ es reintentable). Ver `interpretarDeshacer` en el modelo.
 *
 * Ofrecer Deshacer donde no hay reversión es peor que no ofrecerlo: el dueño aprieta, no pasa
 * nada, y deja de creerle a los otros Deshacer que sí funcionan.
 *
 * ── LAS LEYES, Y DÓNDE ──────────────────────────────────────────────────────────────────────
 * LEY 2 (máx. un rojo): el ÚNICO rojo de la pantalla es el "qué falta" que aparece al pulsar
 * Guardar sin categoría. Ninguna diferencia de monto, ningún estado y ninguna pill van en rojo.
 * LEY 3 (sin evidencia no hay sugerencia): la decide el modelo; acá se respeta en el render —
 * si `haySugerenciaConciliar` es falso, la card NO ofrece "Sí, conciliar" y Enter no resuelve.
 * LEY 6 (ningún botón deshabilitado mudo): Guardar nunca lleva `disabled`; al pulsarlo sin
 * categoría marca en rojo qué falta.
 * LEY 7 (el dato primario no se trunca): contraparte y monto van con `break-words`, nunca con
 * `truncate`; lo truncable es la glosa, que es metadato.
 * LEY 10 (una pantalla, una pregunta): "¿qué necesita tu decisión?" — una card a la vez.
 */

/** Qué candidatos corresponden al movimiento que está en pantalla. El `movimientoId` viaja con la
 *  lista a propósito: si el usuario avanzó y el padre todavía no trajo los del ítem nuevo, la
 *  vista NO pinta los del anterior — muestra que los está buscando. */
export interface CandidatosDelItemV07 {
  movimientoId: string;
  lista: CandidatoV07[];
  cargando?: boolean;
  /** Por qué no se pudieron traer, en lenguaje de dueño. */
  motivo?: string | null;
}

/** Igual que arriba, para la sugerencia de categoría. `valor: null` = ninguna regla matcheó. */
export interface SugerenciaDelItemV07 {
  movimientoId: string;
  valor: SugerenciaCategoriaV07 | null;
  cargando?: boolean;
}

export interface BandejaV07ViewProps {
  /** El brief financiero está visible en la ruta; esta cola queda como auditoría secundaria. */
  secondaryAudit?: boolean;
  /** Ítems de la carta de conciliar. `null` = la cola no llegó. */
  conciliar: ItemConciliarV07[] | null;
  /** Total no paginado informado por la API. Si falta, degrada al largo recibido. */
  conciliarTotal?: number | null;
  /** Ítems de la carta de clasificar. `null` = el listado no llegó. */
  clasificar: ItemClasificarV07[] | null;
  /** Total no paginado informado por la API. La cola visible puede estar limitada a 100. */
  clasificarTotal?: number | null;
  conciliarMotivo?: string | null;
  clasificarMotivo?: string | null;
  candidatos?: CandidatosDelItemV07 | null;
  sugerencia?: SugerenciaDelItemV07 | null;
  /** Catálogo de cuentas de gestión. No es la taxonomía canónica del movimiento. */
  cuentas?: OpcionCuentaV07[];
  /** Tipos de movimiento canónicos publicados por el backend. */
  categoriasCanonicas?: CanonicalCategoryMeta[];
  categoriasCanonicasCargando?: boolean;
  categoriasCanonicasMotivo?: string | null;
  /** Movimientos ya clasificados: de ahí salen los 3 frecuentes cuando no hay regla. */
  clasificados?: BankMovement[];
  /** #1118 — lo que el listado de clasificar dejó FUERA por venir de una cuenta retirada.
   *  `null`/ausente = el listado no llegó: no sabemos nada y no se afirma nada. Un objeto con
   *  `movimientos: 0` NO es eso: es el backend diciendo que no quedó nada fuera. */
  cuentasRetiradas?: MovimientosDeCuentasRetiradas | null;
  /** Confirma el match. `documentoId` va cuando el usuario eligió otro documento. */
  onConciliar: (item: ItemConciliarV07, documentoId: string | null) => Promise<void>;
  /** Deshace una conciliación ya aplicada (`.../revert`). Existe hoy. */
  onDeshacerConciliar?: (item: ItemConciliarV07) => void;
  /** "No es esta": descarta la sugerencia (el movimiento vuelve a `unmatched`). */
  onNoEsEsta: (item: ItemConciliarV07, candidato: CandidatoV07 | null) => Promise<void>;
  onClasificar: (
    item: ItemClasificarV07,
    cuentaId: string,
    categoriaCanonica: string,
    notas: string,
  ) => Promise<void>;
  /** Clasifica una selección explícita de la misma contraparte en una operación atómica. */
  onClasificarLote?: (
    movementIds: string[],
    cuentaId: string,
    categoriaCanonica: string,
    notas: string,
  ) => Promise<void>;
  /** Lo que Qavante clasificó SOLO (auto-clasificación por regla o por conciliación) y todavía se
   *  puede deshacer, más reciente primero. `null` = la bitácora no respondió (se avisa bajito,
   *  no bloquea la carta: es un widget secundario, no el contenido principal). */
  autoClasificadas?: AccionAutoClasificarV07[] | null;
  autoClasificadasMotivo?: string | null;
  /** Deshace UNA fila de la bitácora (`POST /api/reversible-actions/{action_id}/revert`, ADR-0113).
   *  Devuelve la respuesta CRUDA: el resultado (éxito, ya deshecho, vencido, o negado con motivo)
   *  lo decide `interpretarDeshacer` acá en la vista, después de esperarla — nunca se asume éxito
   *  antes de leer la respuesta, porque un Deshacer negado es un 200, no una excepción. */
  onDeshacerAutoClasificar?: (accion: AccionAutoClasificarV07) => Promise<RevertActionResponse>;
  onCrearRegla?: (
    item: ItemClasificarV07,
    cuentaId: string,
    categoriaCanonica: string,
  ) => Promise<void>;
  /** Una escritura falló. Se muestra ARRIBA de la card y en ámbar: es "requiere tu atención",
   *  no un crítico accionable, así que no gasta el único rojo de la pantalla (Ley 2). */
  avisoError?: string | null;
  onCerrarAviso?: () => void;
  /** Avisa qué ítem está en pantalla, para que el padre traiga sus candidatos/su sugerencia. */
  onItemActivo?: (item: ItemV07 | null) => void;
  onReintentar?: () => void;
  /** Compatibilidad de stories antiguas; nunca se presenta al usuario. */
  issueSucesor?: string;
  hoy?: Date;
  /** Tab inicial. Sólo para stories/tests deterministas. */
  tabInicial?: TabV07;
  /** Movimiento pendiente enlazado: selecciona su carta, no sólo sus datos auxiliares. */
  movimientoInicial?: string;
  /** La consulta de la pestaña enlazada devolvió datos (también una cola vacía). */
  enlaceListo?: boolean;
}

const EYEBROW =
  "font-rediseno-sans text-[12px] font-semibold uppercase tracking-[.08em] text-rediseno-tinta-3";
const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";
const BTN_PRIMARIO =
  "inline-flex items-center gap-2 rounded-full bg-rediseno-tinta px-[18px] py-[9px] text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";
const BTN_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-[15px] py-[9px] text-[13px] font-semibold text-rediseno-tinta-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";
const BTN_FANTASMA =
  "inline-flex items-center gap-2 rounded-full px-3 py-[9px] text-[13px] font-semibold text-rediseno-tinta-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";
const KBD = "rounded px-1.5 py-px font-rediseno-mono text-[12px] opacity-70";

/** #1118 — lo que api#1126 sacó del listado, dicho con la leyenda que publica el backend.
 *
 *  Por qué existe: la API dejó de servir los movimientos de cuentas RETIRADAS (la BICE duplicada
 *  de #1007 aportaba 417). Si la pantalla no lo dice, esas 417 filas desaparecen en silencio — y
 *  una desaparición muda es peor que el doble conteo que se vino a arreglar.
 *
 *  Dos reglas que este componente no negocia:
 *
 *  1. El texto es `resumen.leyenda`, tal cual viene. El frontend no reescribe una verdad que el
 *     backend ya publica, y tampoco la parsea: si alguna vez hiciera falta una versión corta, se
 *     deriva de `movimientos`/`cuentas`/`desde`/`hasta`, nunca del string.
 *
 *  2. `movimientos: 0` SE MUESTRA. Cero no es "no hay dato": es la cifra que certifica que el
 *     listado está completo. Pintarlo sólo cuando hay algo fuera dejaría el caso cero
 *     indistinguible de una pantalla que ni siquiera mira el campo — que es justo el defecto que
 *     #1118 vino a cerrar. Lo que sí cambia con el cero es el PESO visual: con movimientos fuera
 *     va en Banner, porque hay algo que ir a buscar; sin ninguno, en una línea secundaria, porque
 *     no hay nada que hacer, sólo algo que saber.
 *
 *  `resumen == null` (el listado no respondió) no pinta nada: callar por no saber es correcto; lo
 *  prohibido es callar sabiendo. */
export function AvisoCuentasRetiradas({
  resumen,
}: {
  resumen?: MovimientosDeCuentasRetiradas | null;
}) {
  if (!resumen) return null;
  if (resumen.movimientos > 0) {
    return (
      <Banner variant="default" data-testid="cuentas-retiradas">
        {resumen.leyenda}
      </Banner>
    );
  }
  return (
    <p className="text-[12.5px] text-rediseno-tinta-3" data-testid="cuentas-retiradas">
      {resumen.leyenda}
    </p>
  );
}

export function BandejaV07View(props: BandejaV07ViewProps) {
  return (
    <RedisenoToastProvider>
      <BandejaV07Contenido {...props} />
    </RedisenoToastProvider>
  );
}

function BandejaV07Contenido({
  secondaryAudit = false,
  conciliar,
  conciliarTotal,
  clasificar,
  clasificarTotal,
  conciliarMotivo,
  clasificarMotivo,
  candidatos,
  sugerencia,
  cuentas = [],
  categoriasCanonicas = [],
  categoriasCanonicasCargando = false,
  categoriasCanonicasMotivo,
  clasificados = [],
  cuentasRetiradas,
  onConciliar,
  onDeshacerConciliar,
  onNoEsEsta,
  onClasificar,
  onClasificarLote,
  autoClasificadas,
  autoClasificadasMotivo,
  onDeshacerAutoClasificar,
  onCrearRegla,
  avisoError,
  onCerrarAviso,
  onItemActivo,
  onReintentar,
  hoy = new Date(),
  tabInicial = "conciliar",
  movimientoInicial,
  enlaceListo = true,
}: BandejaV07ViewProps) {
  const { show } = useRedisenoToast();
  const [tab, setTab] = React.useState<TabV07>(tabInicial);
  const [resueltos, setResueltos] = React.useState<string[]>([]);
  /* Cada monto viaja con SU moneda: lo resuelto se rinde una cifra por moneda, nunca un total
     único con el signo peso sobre pesos y dólares mezclados. */
  const [montos, setMontos] = React.useState<MontoMonedaV07[]>([]);
  const [iConciliar, setIConciliar] = React.useState(0);
  const [iClasificar, setIClasificar] = React.useState(0);
  const [enlacePendiente, setEnlacePendiente] = React.useState(movimientoInicial);
  const [ordenClasificar, setOrdenClasificar] = React.useState<string[] | null>(null);

  const colaConciliar = React.useMemo(
    () => (conciliar ?? []).filter((i) => !resueltos.includes(i.id)),
    [conciliar, resueltos],
  );
  const colaClasificar = React.useMemo(() => {
    const viva = (clasificar ?? []).filter((i) => !resueltos.includes(i.id));
    if (!ordenClasificar) return viva;
    const pos = new Map(ordenClasificar.map((id, idx) => [id, idx]));
    return [...viva].sort(
      (a, b) =>
        (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [clasificar, resueltos, ordenClasificar]);

  /* El índice EFECTIVO: el guardado, acotado a la cola viva. Se calcula una sola vez y se usa
     tanto para pintar como para avanzar — tener dos nociones de "cuál estoy viendo" es el camino
     directo a saltarse un ítem sin resolverlo. */
  const indiceEnlazadoConciliar =
    enlacePendiente && tabInicial === "conciliar"
      ? colaConciliar.findIndex((item) => item.id === enlacePendiente)
      : -1;
  const indiceEnlazadoClasificar =
    enlacePendiente && tabInicial === "clasificar"
      ? colaClasificar.findIndex((item) => item.id === enlacePendiente)
      : -1;
  const idxConciliar =
    indiceEnlazadoConciliar >= 0
      ? indiceEnlazadoConciliar
      : Math.min(iConciliar, Math.max(0, colaConciliar.length - 1));
  const idxClasificar =
    indiceEnlazadoClasificar >= 0
      ? indiceEnlazadoClasificar
      : Math.min(iClasificar, Math.max(0, colaClasificar.length - 1));
  const itemConciliar = colaConciliar[idxConciliar];
  const itemClasificar = colaClasificar[idxClasificar];
  const itemActivo: ItemV07 | null = (tab === "conciliar" ? itemConciliar : itemClasificar) ?? null;

  React.useEffect(() => {
    if (!enlacePendiente || !enlaceListo) return;
    if (indiceEnlazadoConciliar >= 0) setIConciliar(indiceEnlazadoConciliar);
    if (indiceEnlazadoClasificar >= 0) setIClasificar(indiceEnlazadoClasificar);
    setEnlacePendiente(undefined);
  }, [
    enlacePendiente,
    enlaceListo,
    tabInicial,
    conciliar,
    clasificar,
    indiceEnlazadoConciliar,
    indiceEnlazadoClasificar,
  ]);

  /* El padre necesita saber qué hay en pantalla para traer sus candidatos / su sugerencia. */
  const idActivo = itemActivo?.id ?? null;
  React.useEffect(() => {
    onItemActivo?.(itemActivo ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el disparador es el ítem, no la identidad del callback
  }, [idActivo, tab]);

  /* Una decisión confirmada se descuenta mientras todavía aparece en la respuesta anterior.
     Cuando React Query refresca y el ítem desaparece de la fuente, deja de descontarse: así el
     total no baja dos veces. La cabecera usa los totales NO paginados, no el máximo visible. */
  const resueltosConciliarEnFuente = (conciliar ?? []).filter((item) =>
    resueltos.includes(item.id),
  ).length;
  const resueltosClasificarEnFuente = (clasificar ?? []).filter((item) =>
    resueltos.includes(item.id),
  ).length;
  const pendientesConciliar = Math.max(
    0,
    (conciliarTotal ?? conciliar?.length ?? 0) - resueltosConciliarEnFuente,
  );
  const pendientesClasificar = Math.max(
    0,
    (clasificarTotal ?? clasificar?.length ?? 0) - resueltosClasificarEnFuente,
  );
  const pendientes = pendientesConciliar + pendientesClasificar;
  const prog = progreso(resueltos.length, pendientes);
  const totalResuelto = textoResuelto(montos);

  /** Saca el ítem de la cola y avanza. `cuentaLaPlata` es false cuando el ítem se DESCARTÓ: un
   *  "no es esta" saca la sugerencia de la bandeja, pero el movimiento sigue sin conciliar, así
   *  que su monto no puede sumarse a lo que "dejó de estar en duda". */
  function marcarResuelto(item: ItemV07, largoCola: number, cuentaLaPlata = true) {
    setResueltos((prev) => [...prev, item.id]);
    if (cuentaLaPlata) setMontos((prev) => [...prev, { monto: item.monto, moneda: item.moneda }]);
    const siguiente = trasResolver(
      item.tipo === "conciliar" ? idxConciliar : idxClasificar,
      largoCola - 1,
    );
    if (item.tipo === "conciliar") setIConciliar(siguiente);
    else setIClasificar(siguiente);
  }

  function marcarLoteClasificado(ids: string[]) {
    const idSet = new Set(ids);
    const resueltosAhora = colaClasificar.filter((item) => idSet.has(item.id));
    setResueltos((prev) => [...new Set([...prev, ...resueltosAhora.map((item) => item.id)])]);
    setMontos((prev) => [
      ...prev,
      ...resueltosAhora.map((item) => ({ monto: item.monto, moneda: item.moneda })),
    ]);
    setIClasificar(0);
  }

  function saltar() {
    if (tab === "conciliar") setIConciliar(trasSaltar(idxConciliar, colaConciliar.length));
    else setIClasificar(trasSaltar(idxClasificar, colaClasificar.length));
  }

  /* (0) Ninguna de las dos fuentes llegó: la pantalla no está vacía, está ciega — y lo dice. */
  if (conciliar === null && clasificar === null) {
    return (
      <DataState
        status="error"
        what="tu bandeja de excepciones"
        className="font-rediseno-sans"
        headingClassName="font-sans font-semibold"
        cause={
          conciliarMotivo ??
          clasificarMotivo ??
          "No pudimos consultar la cola de conciliación ni los movimientos sin clasificar."
        }
        action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }

  /* (1) BANDEJA VACÍA — el estado celebratorio SOBRIO de la aceptación (§V07). Sólo se celebra
     cuando las DOS fuentes contestaron: con una caída no sabemos si está vacía o si estamos
     ciegos de ese lado, y felicitar a ciegas es la peor versión de esta pantalla. */
  if (pendientes === 0 && conciliar !== null && clasificar !== null) {
    return (
      <div className="space-y-4 font-rediseno-sans">
        <p className={EYEBROW}>Bandeja</p>
        <h1 className="font-sans text-[26px] leading-tight font-semibold text-rediseno-tinta">
          {secondaryAudit ? "No hay movimientos por revisar" : "Nada espera tu decisión"}
        </h1>
        <div className="rounded-[14px] border border-rediseno-hairline border-l-[3px] border-l-rediseno-verde bg-rediseno-superficie px-[17px] py-4">
          <p className="text-[13.5px] text-rediseno-tinta-2">No quedan movimientos por revisar.</p>
          {resueltos.length > 0 && (
            <p className="mt-1.5 text-[12.5px] text-rediseno-tinta-3">
              Resolviste <b className="tabular-nums">{resueltos.length}</b> en esta sesión ·{" "}
              <b className="tabular-nums">{totalResuelto}</b> dejaron de estar en duda.
            </p>
          )}
        </div>
        {/* #1118 — el estado celebratorio es donde más cara sale una desaparición muda:
            "nada espera tu decisión" con 417 movimientos afuera sería sencillamente falso. */}
        <AvisoCuentasRetiradas resumen={cuentasRetiradas} />
      </div>
    );
  }

  /* Una de las dos fuentes se cayó: el conteo de la cabecera es PARCIAL y no puede presentarse
     como si fuera el total. Con cero pendientes de la fuente viva, además, decir "nada espera tu
     decisión" sería directamente falso — no sabemos qué hay del otro lado. */
  const fuenteCaida = conciliar === null || clasificar === null;

  return (
    <div className="space-y-4 font-rediseno-sans">
      <p className={EYEBROW}>Bandeja</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-sans text-[26px] leading-tight font-semibold text-rediseno-tinta">
          {pendientes === 0 && fuenteCaida
            ? "No podemos decirte cuánto te queda"
            : pendientes === 0
              ? "Nada espera tu decisión"
              : `${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"}`}
        </h1>
        <div className="ml-auto">
          <FilterChips
            aria-label="Qué revisar"
            className="mt-0 mb-0"
            options={[
              { id: "conciliar", label: "Conciliar", count: pendientesConciliar },
              { id: "clasificar", label: "Clasificar", count: pendientesClasificar },
            ]}
            value={tab}
            onChange={(v) => setTab(v as TabV07)}
          />
        </div>
      </div>

      {fuenteCaida && (
        <p className="text-[12.5px] text-rediseno-tinta-2">
          El conteo está incompleto. Reintenta en un momento.
        </p>
      )}

      <Progreso prog={prog} monto={totalResuelto} />

      {avisoError && (
        <Banner role="alert" variant="warn" dismissible onDismiss={onCerrarAviso}>
          {avisoError}
        </Banner>
      )}

      {/* #1118 — `cuentas_retiradas` viene del listado `status=unclassified`, así que habla de
          la cola de Clasificar. Va arriba de la carta, donde el usuario mira la lista. */}
      {tab === "clasificar" && <AvisoCuentasRetiradas resumen={cuentasRetiradas} />}

      {tab === "conciliar" ? (
        <CartaConciliar
          item={itemConciliar ?? null}
          indice={idxConciliar}
          total={pendientesConciliar}
          faltaFuente={conciliar === null}
          motivo={conciliarMotivo}
          candidatos={candidatos ?? null}
          hoy={hoy}
          onReintentar={onReintentar}
          onSaltar={saltar}
          onConciliar={async (item, docId, candidato) => {
            try {
              await onConciliar(item, docId);
            } catch {
              /* El live conserva el movimiento y muestra el error de persistencia. */
              return;
            }
            marcarResuelto(item, colaConciliar.length);
            show({
              message: (
                <>
                  Conciliado:{" "}
                  <b>{candidato?.nombre ?? item.contraparteMotor ?? "sin contraparte"}</b> ·{" "}
                  {formatMoney(item.monto, item.moneda)}
                </>
              ),
              /* LEY 5 — acá SÍ, porque la reversión existe (`.../revert`). */
              action: onDeshacerConciliar
                ? { label: "Deshacer", onClick: () => onDeshacerConciliar(item) }
                : undefined,
            });
          }}
          onNoEsEsta={async (item, candidato) => {
            try {
              await onNoEsEsta(item, candidato);
            } catch {
              return;
            }
            marcarResuelto(item, colaConciliar.length, false);
            show({
              message: (
                <>
                  Descartada la sugerencia de <b>{item.contraparteMotor ?? "esta contraparte"}</b> ·{" "}
                  {formatMoney(item.monto, item.moneda)}
                </>
              ),
            });
          }}
        />
      ) : (
        <div className="space-y-3">
          <BitacoraAutoClasificar
            items={autoClasificadas ?? null}
            motivo={autoClasificadasMotivo}
            hoy={hoy}
            onDeshacer={onDeshacerAutoClasificar}
            show={show}
          />
          <CartaClasificar
            item={itemClasificar ?? null}
            cola={colaClasificar}
            indice={idxClasificar}
            total={pendientesClasificar}
            faltaFuente={clasificar === null}
            motivo={clasificarMotivo}
            sugerencia={sugerencia ?? null}
            cuentas={cuentas}
            categoriasCanonicas={categoriasCanonicas}
            categoriasCanonicasCargando={categoriasCanonicasCargando}
            categoriasCanonicasMotivo={categoriasCanonicasMotivo}
            clasificados={clasificados}
            hoy={hoy}
            onReintentar={onReintentar}
            onSaltar={saltar}
            onAgrupar={(ids) => {
              setOrdenClasificar(
                agruparAlFrente(colaClasificar, idxClasificar, ids).map((i) => i.id),
              );
              /* El reordenamiento deja al ítem que estás viendo PRIMERO, así que el índice tiene
                 que volver a 0: si no, la cola se mueve debajo del cursor y terminas mirando otro
                 ítem sin haber resuelto el tuyo. */
              setIClasificar(0);
            }}
            onCrearRegla={
              onCrearRegla
                ? async (item, cuentaId, categoriaCanonica) => {
                    await onCrearRegla(item, cuentaId, categoriaCanonica);
                    show({ message: <>Regla creada: la próxima vez se clasifica sola.</> });
                  }
                : undefined
            }
            onClasificarLote={
              onClasificarLote
                ? async (ids, cuentaId, categoriaCanonica, notas, nombreCuenta) => {
                    await onClasificarLote(ids, cuentaId, categoriaCanonica, notas);
                    marcarLoteClasificado(ids);
                    show({
                      message: (
                        <>
                          Clasificamos {formatCount(ids.length)}{" "}
                          {concordar(ids.length, "movimiento", "movimientos")} como{" "}
                          <b>{nombreCuenta}</b>.
                        </>
                      ),
                    });
                  }
                : undefined
            }
            onGuardar={async (item, cuentaId, categoriaCanonica, notas, nombreCuenta) => {
              try {
                await onClasificar(item, cuentaId, categoriaCanonica, notas);
              } catch {
                return false;
              }
              marcarResuelto(item, colaClasificar.length);
              show({
                message: (
                  <>
                    Clasificado como <b>{nombreCuenta}</b> · {formatMoney(item.monto, item.moneda)}
                  </>
                ),
                /* LEY 5 — acá NO, y es correcto: esto lo decidió el DUEÑO (aceptó una sugerencia
                   o eligió a mano), no Qavante solo. Ver la cabecera del archivo. Lo que Qavante
                  SÍ clasificó solo tiene su propio Deshacer en el banner de arriba. */
              });
              return true;
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Progreso ────────────────────────────────────────────────────────────────────────────── */

function Progreso({ prog, monto }: { prog: ReturnType<typeof progreso>; monto: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-[17px] py-3">
      <div
        className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-rediseno-neutro-bg"
        role="progressbar"
        aria-valuenow={prog.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Excepciones resueltas en esta sesión"
      >
        <div className="h-full rounded-full bg-rediseno-tinta" style={{ width: `${prog.pct}%` }} />
      </div>
      <p className="text-[12.5px] text-rediseno-tinta-2">
        <b className="tabular-nums">{prog.resueltos}</b> de{" "}
        <b className="tabular-nums">{prog.total}</b> resueltos en esta sesión ·{" "}
        <b className="tabular-nums">{monto}</b> dejaron de estar en duda
      </p>
    </div>
  );
}

/* ── Carta de conciliar ──────────────────────────────────────────────────────────────────── */

interface CartaConciliarProps {
  item: ItemConciliarV07 | null;
  indice: number;
  total: number;
  faltaFuente: boolean;
  motivo?: string | null;
  candidatos: CandidatosDelItemV07 | null;
  hoy: Date;
  onReintentar?: () => void;
  onSaltar: () => void;
  onConciliar: (
    item: ItemConciliarV07,
    documentoId: string | null,
    candidato: CandidatoV07 | null,
  ) => Promise<void>;
  onNoEsEsta: (item: ItemConciliarV07, candidato: CandidatoV07 | null) => Promise<void>;
}

function CartaConciliar({
  item,
  indice,
  total,
  faltaFuente,
  motivo,
  candidatos,
  hoy,
  onReintentar,
  onSaltar,
  onConciliar,
  onNoEsEsta,
}: CartaConciliarProps) {
  const [elegido, setElegido] = React.useState<string | null>(null);
  const [buscando, setBuscando] = React.useState(false);
  const [procesando, setProcesando] = React.useState<"conciliar" | "descartar" | null>(null);
  const procesandoRef = React.useRef(false);

  React.useEffect(() => {
    setElegido(null);
    setBuscando(false);
    setProcesando(null);
    procesandoRef.current = false;
  }, [item?.id]);

  const listos = candidatos && item && candidatos.movimientoId === item.id;
  const lista = listos ? candidatos.lista : [];
  const cargando = listos ? Boolean(candidatos.cargando) : Boolean(item);
  const candidato = item ? candidatoElegido(lista, item.documentoPropuesto, elegido) : null;
  const sugerible = item ? haySugerenciaConciliar(item, candidato) : false;
  const bloqueo = item ? bloqueoConciliar(item, candidato) : null;

  async function confirmarActual() {
    if (!item || !sugerible || procesandoRef.current) return;
    procesandoRef.current = true;
    setProcesando("conciliar");
    try {
      await onConciliar(item, elegido, candidato);
    } finally {
      procesandoRef.current = false;
      setProcesando(null);
    }
  }

  async function descartarActual() {
    if (!item || procesandoRef.current) return;
    procesandoRef.current = true;
    setProcesando("descartar");
    try {
      await onNoEsEsta(item, candidato);
    } finally {
      procesandoRef.current = false;
      setProcesando(null);
    }
  }

  useAtajos({
    activo: Boolean(item) && !cargando && !procesando,
    onEnter: () => {
      /* LEY 3 — Enter resuelve el caso CON sugerencia. Sin evidencia dura no hay nada que
         confirmar de un tecleo: la card ofrece buscar el documento a mano. */
      if (item && sugerible) void confirmarActual();
    },
    onTecla: (k) => {
      if (!item) return;
      if (k === "n") void descartarActual();
      if (k === "b") setBuscando((v) => !v);
      if (k === "ArrowRight") onSaltar();
    },
  });

  if (faltaFuente) {
    return (
      <DataState
        status="error"
        what="la cola de conciliación"
        cause={motivo ?? "La cola de conciliación no respondió."}
        action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }

  if (!item) {
    return (
      <DataState
        status="empty"
        what="abonos ni cargos esperando conciliación"
        hint="Todo lo que llegó del banco ya está cruzado con su documento."
      />
    );
  }

  const evidencia = evidenciaConciliar(item, candidato);
  const parte = parcialidad(item, candidato);

  return (
    <section
      aria-label="Excepción por conciliar"
      className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-[18px]"
    >
      <p className={EYEBROW}>
        Conciliar {indice + 1} de {total}
      </p>

      <h2 className="mt-2 font-sans text-[19px] leading-snug font-semibold break-words text-rediseno-tinta">
        {palabraDireccion(item.direccion)} de{" "}
        {item.contraparteMotor ?? candidato?.nombre ?? "contraparte sin identificar"} ·{" "}
        {sugerible ? "¿es este documento?" : "¿con qué documento va?"}
      </h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <LadoBanco item={item} />
        <span aria-hidden className="text-center text-rediseno-tinta-3">
          ⇄
        </span>
        <LadoDocumento
          candidato={candidato}
          cargando={cargando}
          motivo={candidatos?.motivo}
          moneda={item.moneda}
        />
      </div>

      {evidencia.length > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-rediseno-tinta-2">
          <span className={EYEBROW}>Coincide en</span>
          {evidencia.map((e) => (
            <Pill key={e.id} variant="mut">
              {e.texto}
            </Pill>
          ))}
        </p>
      ) : (
        !cargando && (
          <p className="mt-3 text-[12.5px] text-rediseno-tinta-2">No hay coincidencia clara.</p>
        )
      )}

      <LineaDiferencia parte={parte} item={item} candidato={candidato} />

      {item.documentos > 1 && (
        <p className="mt-1.5 text-[12.5px] text-rediseno-tinta-2">
          Esta sugerencia cubre <b>{item.documentos} documentos</b> y al confirmar se aplican todos,
          no sólo el que ves.
        </p>
      )}

      {/* DONDE IBA EL BOTÓN VA EL MOTIVO, NOMBRADO POR EL SERVIDOR.
          "Elige un documento o sáltalo" es verdad pero no dice POR QUÉ no se puede conciliar
          contra el que está a la vista. El contrato publica esa frase con el monto del problema
          adentro ("el movimiento supera en $380.000 el saldo del documento") y dice que la
          pantalla muestre ÉSA en vez de su genérica. El candidato se sigue mostrando: saber que
          hay una factura que casi calza es información útil, y esconderla no ayuda a nadie.
          El cierre depende de `retryable`, que es del backend: con `false`, repetir da el mismo
          resultado y la copia no puede mandar a reintentar. */}
      {!sugerible && !cargando && (
        <p className="mt-2 text-[12.5px] text-rediseno-tinta-2">
          {bloqueo
            ? `${bloqueo.mensaje} ${
                bloqueo.reintentable
                  ? "Actualiza la cola y vuelve a intentar."
                  : "Elige otro documento o sáltalo."
              }`
            : "Elige un documento o sáltalo."}
        </p>
      )}

      {buscando && (
        <ListaCandidatos
          lista={lista}
          elegido={candidato?.documentId ?? null}
          cargando={cargando}
          moneda={item.moneda}
          onElegir={(id) => {
            setElegido(id);
            setBuscando(false);
          }}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {sugerible ? (
          <button
            type="button"
            className={BTN_PRIMARIO}
            disabled={Boolean(procesando)}
            onClick={() => void confirmarActual()}
          >
            {procesando === "conciliar" ? "Conciliando…" : "Sí, conciliar"}{" "}
            <span className={KBD}>Enter</span>
          </button>
        ) : (
          <button
            type="button"
            className={BTN_PRIMARIO}
            disabled={Boolean(procesando)}
            onClick={() => setBuscando((v) => !v)}
          >
            Buscar el documento <span className={KBD}>B</span>
          </button>
        )}
        <button
          type="button"
          className={BTN_SECUNDARIO}
          disabled={Boolean(procesando)}
          onClick={() => void descartarActual()}
        >
          {procesando === "descartar" ? "Descartando…" : "No es esta"}{" "}
          <span className={KBD}>N</span>
        </button>
        {sugerible && (
          <button
            type="button"
            className={BTN_SECUNDARIO}
            disabled={Boolean(procesando)}
            onClick={() => setBuscando((v) => !v)}
          >
            Buscar otra <span className={KBD}>B</span>
          </button>
        )}
        <button
          type="button"
          className={BTN_FANTASMA}
          disabled={Boolean(procesando)}
          onClick={onSaltar}
        >
          Saltar <span className={KBD}>→</span>
        </button>
      </div>
    </section>
  );
}

function LadoBanco({ item }: { item: ItemConciliarV07 }) {
  return (
    <div className="rounded-xl border border-rediseno-hairline bg-rediseno-porcelana px-4 py-3">
      <p className={EYEBROW}>En el banco · {formatDateLong(item.fecha)}</p>
      <p className="mt-1 font-sans text-[20px] font-semibold break-words tabular-nums text-rediseno-tinta">
        {palabraDireccion(item.direccion)} {formatMoney(item.monto, item.moneda)}
      </p>
      <p className="mt-0.5 text-[12.5px] break-words text-rediseno-tinta-2">
        {item.glosa ?? "sin glosa"}
      </p>
    </div>
  );
}

function LadoDocumento({
  candidato,
  cargando,
  motivo,
  moneda,
}: {
  candidato: CandidatoV07 | null;
  cargando: boolean;
  motivo?: string | null;
  /* La moneda del DOCUMENTO no está en el contrato (`DocumentSuggestion` publica `amount` y no
   publica moneda). Se rinde con la del MOVIMIENTO porque es contra él que se compara, y porque
   el servidor bloquea el cruce de monedas con su propio `currency_mismatch`: una conciliación
   confirmable es, por definición del productor, en la misma moneda. No se cae a CLP. */
  moneda: string | null;
}) {
  if (cargando) {
    return (
      <div
        className="rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-4 py-3"
        aria-busy="true"
      >
        <p className={EYEBROW}>Documento candidato</p>
        <p className="mt-1 text-[12.5px] text-rediseno-tinta-2">
          Estamos trayendo los documentos que podrían calzar.
        </p>
      </div>
    );
  }
  if (!candidato) {
    return (
      <div className="rounded-xl border border-dashed border-rediseno-hairline px-4 py-3">
        <p className={EYEBROW}>Documento candidato</p>
        <p className="mt-1 text-[12.5px] text-rediseno-tinta-2">
          {motivo ?? "No hay ningún documento candidato para este movimiento."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-4 py-3">
      <p className={EYEBROW}>{etiquetaDocumento(candidato)}</p>
      <p className="mt-1 font-sans text-[20px] font-semibold break-words tabular-nums text-rediseno-tinta">
        {candidato.monto == null ? "monto no informado" : formatMoney(candidato.monto, moneda)}
      </p>
      <p className="mt-0.5 text-[12.5px] break-words text-rediseno-tinta-2">
        {candidato.nombre ?? "contraparte sin nombre"}
        {candidato.rut ? ` · ${formatRut(candidato.rut)}` : ""} ·{" "}
        {candidato.fecha ? formatDateLong(candidato.fecha) : "sin fecha"}
      </p>
    </div>
  );
}

function etiquetaDocumento(c: CandidatoV07): string {
  const tipo = c.tipoDte ? `DTE ${c.tipoDte}` : "Documento";
  const folio = c.folio ? ` · ${c.folio}` : "";
  return `Candidato · ${tipo}${folio}`;
}

function LineaDiferencia({
  parte,
  item,
  candidato,
}: {
  parte: ReturnType<typeof parcialidad>;
  item: ItemConciliarV07;
  candidato: CandidatoV07 | null;
}) {
  /* B12 — los verbos van segun la direccion del movimiento, no fijos. Un cargo contra una factura
     de proveedor decia "Entró ... más que el documento" y "quedan ... por cobrar": lo contrario de
     lo que pasó. */
  const verbo = verboDireccion(item.direccion);
  const verboPl = verboDireccionPlural(item.direccion);
  const rumbo = rumboPendiente(item.direccion);
  let texto: React.ReactNode = null;
  if (parte.tipo === "exacta") texto = <>El monto calza exacto con el documento.</>;
  if (parte.tipo === "parcial") {
    texto = (
      <>
        Pago parcial: {verboPl ? `${verboPl} ` : "el movimiento cubre "}
        {formatMoney(item.monto, item.moneda)} de {formatMoney(candidato?.monto ?? 0, item.moneda)};
        quedan <b className="tabular-nums">{formatMoney(parte.restante, item.moneda)}</b> {rumbo}.
      </>
    );
  }
  if (parte.tipo === "exceso") {
    texto = (
      <>
        {verbo ? `${verbo} ` : "Se movió "}
        <b className="tabular-nums">{formatMoney(parte.monto, item.moneda)}</b> más que el
        documento: revisa si cubre más de una factura.
      </>
    );
  }
  if (parte.tipo === "sin-monto") {
    texto = <>El documento no trae monto comparable, así que la diferencia no se puede calcular.</>;
  }
  if (!texto) return null;
  /* B14 — UNA SOLA referencia temporal por tarjeta. Acá convivía "El documento es de hace 61 días"
     con el chip "a 23 días del documento", que miden cosas distintas (documento↔hoy y
     documento↔movimiento) y se leían como contradicción. La fecha del documento sigue entera y sin
     relativo en el bloque "Candidato", que es donde corresponde. */
  return <p className="mt-2 text-[13px] text-rediseno-tinta-2">{texto}</p>;
}

function ListaCandidatos({
  lista,
  elegido,
  cargando,
  onElegir,
  moneda,
}: {
  lista: CandidatoV07[];
  elegido: string | null;
  cargando: boolean;
  onElegir: (id: string) => void;
  /* La moneda del DOCUMENTO no está en el contrato (`DocumentSuggestion` publica `amount` y no
   publica moneda). Se rinde con la del MOVIMIENTO porque es contra él que se compara, y porque
   el servidor bloquea el cruce de monedas con su propio `currency_mismatch`: una conciliación
   confirmable es, por definición del productor, en la misma moneda. No se cae a CLP. */
  moneda: string | null;
}) {
  if (cargando) {
    return (
      <p className="mt-3 text-[12.5px] text-rediseno-tinta-2" aria-busy="true">
        Estamos trayendo los documentos que podrían calzar.
      </p>
    );
  }
  if (lista.length === 0) {
    return (
      <p className="mt-3 text-[12.5px] text-rediseno-tinta-2">
        No hay otros documentos candidatos para este movimiento.
      </p>
    );
  }
  return (
    <fieldset className="mt-3 rounded-xl border border-rediseno-hairline p-3">
      <legend className={EYEBROW}>Elegir otro documento</legend>
      <ul className="space-y-1.5">
        {lista.map((c) => (
          <li key={c.documentId}>
            <label className="flex flex-wrap items-baseline gap-2 text-[12.5px] text-rediseno-tinta-2">
              <input
                type="radio"
                name="candidato"
                value={c.documentId}
                checked={elegido === c.documentId}
                onChange={() => onElegir(c.documentId)}
              />
              <b className="break-words text-rediseno-tinta">
                {c.nombre ?? "contraparte sin nombre"}
              </b>
              <span className="tabular-nums">
                {c.monto == null ? "monto no informado" : formatMoney(c.monto, moneda)}
              </span>
              <span>
                {etiquetaDocumento(c)} · {c.fecha ? formatDateLong(c.fecha) : "sin fecha"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function palabraDireccion(d: "credit" | "debit" | null): string {
  if (d === "credit") return "Abono";
  if (d === "debit") return "Cargo";
  return "Movimiento";
}

/* ── Ley 5 en clasificar: lo que Qavante clasificó SOLO, con Deshacer real ──────────────────
 *
 * Distinto del toast de "Guardar" (ver más abajo): esto es la bitácora de `apply-rules` /
 * `classify-reconciled`, NO del clic del dueño. Un Deshacer negado es un 200 con `result:
 * "undo_not_supported"`, nunca un error — por eso se ESPERA la respuesta y se interpreta con
 * `interpretarDeshacer` antes de decidir el toast; no se asume éxito al pedirlo. */

function BitacoraAutoClasificar({
  items,
  motivo,
  hoy,
  onDeshacer,
  show,
}: {
  items: AccionAutoClasificarV07[] | null;
  motivo?: string | null;
  hoy: Date;
  onDeshacer?: (accion: AccionAutoClasificarV07) => Promise<RevertActionResponse>;
  show: (toast: Omit<RedisenoToast, "id">) => string;
}) {
  const [procesando, setProcesando] = React.useState<string | null>(null);

  if (items === null) {
    /* Widget secundario: si su fuente cae, lo dice bajito y sigue — no bloquea la carta
       principal, que es "qué clasificar", con un DataState de pantalla completa. */
    return motivo ? (
      <p className="text-[12px] text-rediseno-tinta-3">
        No pudimos traer lo que Qavante clasificó solo: {motivo}
      </p>
    ) : null;
  }
  const primero = items[0];
  if (!primero) return null;
  const resto = items.slice(1);

  async function deshacer(accion: AccionAutoClasificarV07) {
    if (!onDeshacer || procesando) return;
    setProcesando(accion.actionId);
    try {
      const resultado = interpretarDeshacer(await onDeshacer(accion));
      if (resultado.tipo === "deshecho") {
        show({
          message: (
            <>
              Deshecho: <b className="break-words">{accion.resumen}</b> volvió a &ldquo;sin
              clasificar&rdquo;.
            </>
          ),
        });
      } else if (resultado.tipo === "ya-deshecho") {
        show({ message: <>Esto ya se había deshecho antes: no queda nada que hacer.</> });
      } else if (resultado.tipo === "vencido") {
        show({
          message: (
            <>Pasaron más de 7 días desde esta clasificación automática: ya no se puede deshacer.</>
          ),
        });
      } else if (resultado.tipo === "protegido") {
        /* estado_derivado — NO reintentable: reintentar no arregla nada, el cambio del dueño
           sigue vigente y así debe quedar. Por eso este toast NO lleva acción "Reintentar". */
        show({ message: <>No se deshizo nada: {resultado.explicacion}</> });
      } else if (resultado.tipo === "bloqueado") {
        /* estado_bloqueado — SÍ reintentable. */
        show({
          message: <>No se deshizo nada: {resultado.explicacion}</>,
          action: { label: "Reintentar", onClick: () => void deshacer(accion) },
        });
      } else {
        /* "no sé" explícito: el backend no dio un motivo reconocido. No se inventa uno. */
        show({
          message: (
            <>No pudimos deshacer esta acción ni confirmar el motivo. No se registraron cambios.</>
          ),
          action: { label: "Reintentar", onClick: () => void deshacer(accion) },
        });
      }
    } catch {
      show({
        message: <>No pudimos deshacer esto: se cortó la conexión. Vuelve a intentar.</>,
        action: { label: "Reintentar", onClick: () => void deshacer(accion) },
      });
    } finally {
      setProcesando(null);
    }
  }

  return (
    <Banner
      role="note"
      action={
        onDeshacer
          ? {
              label: procesando === primero.actionId ? "Deshaciendo…" : "Deshacer",
              onClick: () => void deshacer(primero),
            }
          : undefined
      }
    >
      Qavante clasificó <b className="break-words">{primero.resumen}</b> solo,{" "}
      {formatRelative(primero.creadaEn, hoy)}.
      {resto.length > 0 && (
        <>
          {" "}
          Hay {formatCount(resto.length)}{" "}
          {concordar(
            resto.length,
            "clasificación automática más",
            "clasificaciones automáticas más",
          )}
          , también {concordar(resto.length, "deshacible", "deshacibles")}.
        </>
      )}
    </Banner>
  );
}

/* ── Carta de clasificar ─────────────────────────────────────────────────────────────────── */

interface CartaClasificarProps {
  item: ItemClasificarV07 | null;
  cola: ItemClasificarV07[];
  indice: number;
  total: number;
  faltaFuente: boolean;
  motivo?: string | null;
  sugerencia: SugerenciaDelItemV07 | null;
  cuentas: OpcionCuentaV07[];
  categoriasCanonicas: CanonicalCategoryMeta[];
  categoriasCanonicasCargando: boolean;
  categoriasCanonicasMotivo?: string | null;
  clasificados: BankMovement[];
  hoy: Date;
  onReintentar?: () => void;
  onSaltar: () => void;
  onAgrupar: (ids: string[]) => void;
  onCrearRegla?: (
    item: ItemClasificarV07,
    cuentaId: string,
    categoriaCanonica: string,
  ) => Promise<void>;
  onClasificarLote?: (
    ids: string[],
    cuentaId: string,
    categoriaCanonica: string,
    notas: string,
    nombreCuenta: string,
  ) => Promise<void>;
  onGuardar: (
    item: ItemClasificarV07,
    cuentaId: string,
    categoriaCanonica: string,
    notas: string,
    nombreCuenta: string,
  ) => Promise<boolean>;
}

function CartaClasificar({
  item,
  cola,
  indice,
  total,
  faltaFuente,
  motivo,
  sugerencia,
  cuentas,
  categoriasCanonicas,
  categoriasCanonicasCargando,
  categoriasCanonicasMotivo,
  clasificados,
  hoy,
  onReintentar,
  onSaltar,
  onAgrupar,
  onCrearRegla,
  onClasificarLote,
  onGuardar,
}: CartaClasificarProps) {
  const [cuentaId, setCuentaId] = React.useState<string | null>(item?.cuentaIdActual ?? null);
  const [categoriaCanonica, setCategoriaCanonica] = React.useState<string | null>(
    item?.categoriaCanonicaActual ?? null,
  );
  const [notas, setNotas] = React.useState("");
  const [falta, setFalta] = React.useState<string | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const [clasificandoLote, setClasificandoLote] = React.useState(false);
  const escribiendoRef = React.useRef(false);
  const [confirmarLote, setConfirmarLote] = React.useState(false);
  const [ofertaRegla, setOfertaRegla] = React.useState<{
    item: ItemClasificarV07;
    cuentaId: string;
    categoriaCanonica: string;
    nombre: string;
  } | null>(null);

  const sugerenciaViva =
    sugerencia && item && sugerencia.movimientoId === item.id ? sugerencia : null;
  const valorSugerido = sugerenciaViva?.valor ?? null;

  React.useEffect(() => {
    setCuentaId(item?.cuentaIdActual ?? null);
    setCategoriaCanonica(item?.categoriaCanonicaActual ?? null);
    setNotas("");
    setFalta(null);
    setGuardando(false);
    setClasificandoLote(false);
    escribiendoRef.current = false;
    setConfirmarLote(false);
  }, [item?.id, item?.cuentaIdActual, item?.categoriaCanonicaActual]);

  /* La sugerencia PRE-SELECCIONA (spec: "sugerencia primero si existe regla"), nunca guarda sola. */
  React.useEffect(() => {
    if (valorSugerido?.cuentaId && !item?.cuentaIdActual) setCuentaId(valorSugerido.cuentaId);
    const tipoCompatible = categoriasParaDireccion(
      categoriasCanonicas,
      item?.direccion ?? null,
    ).some((c) => c.code === valorSugerido?.categoriaCanonica);
    if (valorSugerido?.categoriaCanonica && tipoCompatible && !item?.categoriaCanonicaActual) {
      setCategoriaCanonica(valorSugerido.categoriaCanonica);
    }
  }, [
    valorSugerido?.cuentaId,
    valorSugerido?.categoriaCanonica,
    item?.id,
    item?.cuentaIdActual,
    item?.categoriaCanonicaActual,
    item?.direccion,
    categoriasCanonicas,
  ]);

  /* La regla de direccion vive en UN solo lugar (`categoriasParaDireccion`) para que la Bandeja y
     `/caja/clasificados` no puedan separarse: estaban separadas, y la segunda ofrecia tipos de
     ENTRADA para un cargo. */
  const categoriasCompatibles = React.useMemo(
    () => categoriasParaDireccion(categoriasCanonicas, item?.direccion ?? null),
    [categoriasCanonicas, item?.direccion],
  );

  const cuentasPorId = React.useMemo(
    () => new Map(cuentas.map((c) => [c.id, c] as const)),
    [cuentas],
  );
  const categoriasPorCodigo = React.useMemo(
    () => new Map(categoriasCanonicas.map((c) => [c.code, c] as const)),
    [categoriasCanonicas],
  );
  const categoriaSugeridaDisponible =
    valorSugerido?.categoriaCanonica != null &&
    categoriasCompatibles.some((c) => c.code === valorSugerido.categoriaCanonica);
  const frec = React.useMemo(
    () =>
      item
        ? frecuentes(clasificados, item, cuentasPorId)
        : { items: [], criterio: "ninguno" as const },
    [clasificados, item, cuentasPorId],
  );
  const grupo = React.useMemo(() => lote(cola, item), [cola, item]);

  async function guardar() {
    if (!item || escribiendoRef.current) return;
    if (categoriasCanonicasCargando) {
      setFalta("Espera un momento: estamos cargando los tipos de movimiento.");
      return;
    }
    if (categoriasCanonicasMotivo) {
      setFalta("No pudimos cargar los tipos de movimiento. Reintenta antes de guardar.");
      return;
    }
    const queFalta = faltaParaGuardar({ cuentaId, categoriaCanonica, notas });
    if (queFalta) {
      /* LEY 6 — el primario respondió: no está deshabilitado, y dice qué falta. */
      setFalta(queFalta);
      return;
    }
    const id = cuentaId as string;
    const tipo = categoriaCanonica as string;
    const nombre = cuentasPorId.get(id)?.nombre ?? "la categoría elegida";
    const fueManual = valorSugerido?.cuentaId !== id || valorSugerido?.categoriaCanonica !== tipo;
    escribiendoRef.current = true;
    setGuardando(true);
    try {
      const guardado = await onGuardar(item, id, tipo, notas, nombre);
      if (guardado) {
        setOfertaRegla(fueManual ? { item, cuentaId: id, categoriaCanonica: tipo, nombre } : null);
      }
    } finally {
      escribiendoRef.current = false;
      setGuardando(false);
    }
  }

  function prepararLote() {
    if (!item || !grupo || escribiendoRef.current) return;
    const queFalta = faltaParaGuardar({ cuentaId, categoriaCanonica, notas });
    if (queFalta) {
      setFalta(queFalta);
      return;
    }
    setConfirmarLote(true);
  }

  async function confirmarClasificacionLote() {
    if (!item || !grupo || !cuentaId || !categoriaCanonica || escribiendoRef.current) return;
    const nombre = cuentasPorId.get(cuentaId)?.nombre ?? "la categoría elegida";
    escribiendoRef.current = true;
    setClasificandoLote(true);
    try {
      await onClasificarLote?.(grupo.ids, cuentaId, categoriaCanonica, notas, nombre);
      setConfirmarLote(false);
    } catch {
      /* El live ya mostró el error y no retiramos ningún movimiento de la cola. */
    } finally {
      escribiendoRef.current = false;
      setClasificandoLote(false);
    }
  }

  useAtajos({
    activo: Boolean(item) && !guardando && !clasificandoLote,
    onEnter: () => void guardar(),
    onTecla: (k) => {
      if (k === "ArrowRight") onSaltar();
    },
  });

  if (faltaFuente) {
    return (
      <DataState
        status="error"
        what="los movimientos sin clasificar"
        cause={motivo ?? "El listado de movimientos no respondió."}
        action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <DataState
          status="empty"
          what="movimientos sin clasificar"
          hint="Cada movimiento del banco ya tiene su categoría, así que tus informes no dejan nada afuera de esta bandeja."
        />
        {ofertaRegla && (
          <OfertaRegla
            oferta={ofertaRegla}
            onCrear={onCrearRegla}
            onCerrar={() => setOfertaRegla(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grupo && (
        <Banner
          role="note"
          action={{
            label: `Revisar los ${grupo.otros + 1} seguidos`,
            onClick: () => onAgrupar(grupo.ids),
          }}
        >
          Hay <b>{grupo.otros} más</b> de{" "}
          <b className="break-words">
            {grupo.porCuenta
              ? `la cuenta destino ${grupo.etiqueta}`
              : grupo.porRut
                ? formatRut(grupo.etiqueta)
                : `“${grupo.etiqueta}”`}
          </b>{" "}
          esperando categoría
          {grupo.porCuenta || grupo.porRut
            ? ""
            : " (agrupados por glosa idéntica, no por RUT: la glosa no trae uno)"}
          . Puedes clasificarlos de una sola vez después de elegir categoría y confirmar.
        </Banner>
      )}

      <section
        aria-label="Excepción por clasificar"
        className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-[18px]"
      >
        <p className={EYEBROW}>
          Clasificar {indice + 1} de {total} ·{" "}
          {valorSugerido ? "Sugerencia disponible" : "Elige una categoría"}
        </p>

        <h2 className="mt-2 font-sans text-[19px] leading-snug font-semibold break-words text-rediseno-tinta">
          {palabraDireccion(item.direccion)} {formatMoney(item.monto, item.moneda)} ·{" "}
          {item.glosa ? `“${item.glosa}”` : "sin glosa"} · {formatDateLong(item.fecha)}
        </h2>
        <p className="mt-1 text-[12.5px] text-rediseno-tinta-3">
          {formatRelative(item.fecha, hoy)}
          {item.rutGlosa
            ? ` · RUT en la glosa: ${formatRut(item.rutGlosa)}`
            : " · sin RUT en la glosa"}
        </p>

        {valorSugerido && (
          <p className="mt-3 text-[13px] text-rediseno-tinta-2">
            <span className={EYEBROW}>Sugerido</span>{" "}
            <b className="break-words text-rediseno-tinta">{valorSugerido.nombre}</b> · una regla
            tuya
            {valorSugerido.cuentaId
              ? ""
              : " · pero esa cuenta no admite imputación (está inactiva o agrupa a otras), así que hay que elegirla a mano"}
            {categoriaSugeridaDisponible
              ? ` · ${categoriasPorCodigo.get(valorSugerido.categoriaCanonica!)?.label ?? valorSugerido.categoriaCanonica}`
              : " · la regla no define un tipo de movimiento válido para este cargo/abono, así que hay que elegirlo"}
          </p>
        )}

        {!valorSugerido && (
          <Frecuentes
            frec={frec}
            elegido={cuentaId}
            onElegir={(id) => {
              setCuentaId(id);
              setFalta(null);
            }}
          />
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="bandeja-tipo-movimiento"
              className="mb-1 block text-[12.5px] font-semibold text-rediseno-tinta-2"
            >
              Tipo de movimiento
            </label>
            <select
              id="bandeja-tipo-movimiento"
              className="w-full rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-3 py-2 text-[13px] text-rediseno-tinta focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
              value={categoriaCanonica ?? ""}
              disabled={categoriasCanonicasCargando || Boolean(categoriasCanonicasMotivo)}
              onChange={(e) => {
                setCategoriaCanonica(e.target.value || null);
                setFalta(null);
              }}
            >
              <option value="">
                {categoriasCanonicasCargando
                  ? "Cargando tipos de movimiento…"
                  : categoriasCanonicasMotivo
                    ? "No pudimos cargar los tipos"
                    : "Elige el tipo de movimiento…"}
              </option>
              {categoriasCompatibles.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {categoriasCanonicasMotivo && (
              <p className="mt-1 text-[11.5px] font-semibold text-rediseno-ambar-text">
                {categoriasCanonicasMotivo}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="bandeja-categoria"
              className="mb-1 block text-[12.5px] font-semibold text-rediseno-tinta-2"
            >
              Cuenta de gestión
            </label>
            <select
              id="bandeja-categoria"
              className="w-full rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-3 py-2 text-[13px] text-rediseno-tinta focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
              value={cuentaId ?? ""}
              onChange={(e) => {
                setCuentaId(e.target.value || null);
                setFalta(null);
              }}
            >
              <option value="">Elige una cuenta de gestión…</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.seleccionable}>
                  {c.codigo ? `${c.codigo} · ` : ""}
                  {c.nombre}
                  {c.seleccionable
                    ? ""
                    : c.agrupadora
                      ? " (agrupa a otras cuentas)"
                      : " (inactiva)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <details className="mt-3">
          <summary className={cn(LINK, "cursor-pointer text-[12.5px]")}>
            + Agregar detalle (opcional)
          </summary>
          <div className="mt-2 space-y-2">
            <label
              htmlFor="bandeja-notas"
              className="block text-[12.5px] font-semibold text-rediseno-tinta-2"
            >
              Nota para el contador
            </label>
            <textarea
              id="bandeja-notas"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-xl border border-rediseno-hairline px-3 py-2 text-[13px] focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
            />
          </div>
        </details>

        {falta && (
          /* EL ÚNICO ROJO DE LA PANTALLA (Ley 2), y sólo después de pulsar (Ley 6). */
          <p role="alert" className="mt-3 text-[13px] font-semibold text-rediseno-rojo">
            {falta}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BTN_PRIMARIO}
            onClick={guardar}
            disabled={guardando || clasificandoLote}
          >
            {guardando ? "Guardando…" : "Guardar"} <span className={KBD}>Enter</span>
          </button>
          {grupo && onClasificarLote && !confirmarLote && (
            <button
              type="button"
              className={BTN_SECUNDARIO}
              onClick={prepararLote}
              disabled={guardando || clasificandoLote}
            >
              Clasificar {grupo.otros + 1} de una vez
            </button>
          )}
          <button
            type="button"
            className={BTN_FANTASMA}
            onClick={onSaltar}
            disabled={guardando || clasificandoLote}
          >
            Saltar <span className={KBD}>→</span>
          </button>
        </div>

        {confirmarLote && grupo && (
          <Banner
            role="alert"
            className="mt-3"
            action={{
              label: clasificandoLote ? "Clasificando…" : `Sí, clasificar ${grupo.otros + 1}`,
              onClick: confirmarClasificacionLote,
            }}
          >
            Vas a clasificar {formatCount(grupo.otros + 1)}{" "}
            {concordar(grupo.otros + 1, "movimiento", "movimientos")} como{" "}
            <b>{categoriasPorCodigo.get(categoriaCanonica ?? "")?.label ?? "el tipo elegido"}</b>
            {" · "}
            <b>{cuentasPorId.get(cuentaId ?? "")?.nombre ?? "la cuenta elegida"}</b>. Esta decisión
            manual no tiene Deshacer.
            <button
              type="button"
              className={cn(LINK, "ml-2")}
              onClick={() => setConfirmarLote(false)}
              disabled={clasificandoLote}
            >
              Cancelar
            </button>
          </Banner>
        )}
      </section>

      {ofertaRegla && (
        <OfertaRegla
          oferta={ofertaRegla}
          onCrear={onCrearRegla}
          onCerrar={() => setOfertaRegla(null)}
        />
      )}
    </div>
  );
}

function Frecuentes({
  frec,
  elegido,
  onElegir,
}: {
  frec: ReturnType<typeof frecuentes>;
  elegido: string | null;
  onElegir: (id: string) => void;
}) {
  if (frec.criterio === "ninguno") {
    return (
      <p className="mt-3 text-[12.5px] text-rediseno-tinta-2">Elige una cuenta de la lista.</p>
    );
  }
  return (
    <div className="mt-3">
      <p className="text-[12.5px] text-rediseno-tinta-2">Usadas recientemente:</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {frec.items.map((f) => (
          <button
            key={f.cuentaId}
            type="button"
            onClick={() => onElegir(f.cuentaId)}
            aria-pressed={elegido === f.cuentaId}
            className={cn(
              "rounded-full border border-rediseno-hairline px-[13px] py-[7px] text-xs font-semibold text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none",
              elegido === f.cuentaId && "border-rediseno-tinta bg-rediseno-tinta text-white",
            )}
          >
            {f.nombre} · {f.veces}
          </button>
        ))}
      </div>
    </div>
  );
}

function OfertaRegla({
  oferta,
  onCrear,
  onCerrar,
}: {
  oferta: {
    item: ItemClasificarV07;
    cuentaId: string;
    categoriaCanonica: string;
    nombre: string;
  };
  onCrear?: (item: ItemClasificarV07, cuentaId: string, categoriaCanonica: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [creando, setCreando] = React.useState(false);
  const creandoRef = React.useRef(false);
  const quien = oferta.item.cuentaDestino
    ? `la cuenta destino ${oferta.item.cuentaDestino}`
    : oferta.item.rutGlosa
      ? `el RUT ${formatRut(oferta.item.rutGlosa)}`
      : `los movimientos con la glosa “${oferta.item.glosa ?? "sin glosa"}”`;
  return (
    <Banner
      role="note"
      variant="ok"
      dismissible={!creando}
      onDismiss={onCerrar}
      action={
        onCrear
          ? {
              label: creando ? "Creando…" : "Crear regla",
              disabled: creando,
              onClick: async () => {
                if (creandoRef.current) return;
                creandoRef.current = true;
                setCreando(true);
                try {
                  await onCrear(oferta.item, oferta.cuentaId, oferta.categoriaCanonica);
                  onCerrar();
                } catch {
                  /* El live deja el error accionable arriba; la oferta permanece para reintentar. */
                } finally {
                  creandoRef.current = false;
                  setCreando(false);
                }
              },
            }
          : undefined
      }
    >
      ¿Siempre <b className="break-words">{oferta.nombre}</b> para <b>{quien}</b>?
    </Banner>
  );
}

export function mensajeSinSugerenciaConciliar(
  item: ItemConciliarV07,
  candidatosCount: number,
  errorCandidatos?: string | null,
): string {
  if (errorCandidatos) {
    return "No pudimos cargar los documentos candidatos. La consulta no se considera vacía.";
  }
  if (candidatosCount === 0) {
    return "La consulta terminó sin documentos candidatos para este movimiento.";
  }
  if (primerRutEnTexto(item.glosa)) {
    return "La glosa incluye un RUT, pero no encontramos una coincidencia suficiente.";
  }
  return "La glosa no incluye un RUT y ningún monto coincide con precisión suficiente.";
}

/* ── Atajos de teclado ───────────────────────────────────────────────────────────────────── */

/** Atajos globales de la card. Se ignoran mientras escribes (input/textarea/select/editable) y
 *  con modificadores: un atajo que dispara una acción de plata mientras tecleas una nota es un
 *  bug caro. */
function useAtajos({
  activo,
  onEnter,
  onTecla,
}: {
  activo: boolean;
  onEnter: () => void;
  onTecla: (k: string) => void;
}) {
  const refEnter = React.useRef(onEnter);
  const refTecla = React.useRef(onTecla);
  refEnter.current = onEnter;
  refTecla.current = onTecla;

  React.useEffect(() => {
    if (!activo) return;
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (e.key === "Enter") {
        e.preventDefault();
        refEnter.current();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "n" || k === "b" || k === "ArrowRight") {
        e.preventDefault();
        refTecla.current(k);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activo]);
}
