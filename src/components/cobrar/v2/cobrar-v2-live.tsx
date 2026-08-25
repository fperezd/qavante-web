"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  useAccountsReceivable,
  type AccountsReceivableResponse,
  type TopDebtor,
} from "@/lib/api/cobranza";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import {
  PartialDataBanner,
  SyncPendingState,
  isPartial,
  isSyncPending,
} from "@/components/treasury/sync-pending-state";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { SortBar } from "@/components/filters/sort-bar";
import { formatClp } from "@/lib/formatters/clp";
import {
  parseAmount,
  parseAmountOrNull,
  agingBreakdown,
  explicarVencidoSinDato,
  rutKey,
  vencidoDeDeudor,
  totalVencidoDeudores,
} from "../cobranza-format";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import {
  readTerminos,
  readPagados,
  buildMaestro,
  type DocMaestro,
} from "@/components/terminos/terminos-pago";
import { CobrarHero } from "./cobrar-hero";
import { CobranzaAcciones } from "./cobranza-acciones";
import { CobrarV2View, ResumenCobranza, DeudorRow } from "./cobrar-v2-view";
import { formatPct } from "@/lib/formatters/pct";
import {
  pickPrioridad,
  reminderText,
  waHref,
  mailtoHref,
  readGestionado,
  isGestionado,
  withGestionado,
  withoutGestionado,
  readGestionadoDocs,
  isGestionadoDoc,
  withGestionadoDoc,
  withoutGestionadoDoc,
  sortDebtors,
  peorMoraDias,
  relatoVencido,
} from "./cobrar-v2-map";

/* Vista LIVE de Cobrar v2 (rediseño 2026-07-19), gated por `cobrarV2`. Cablea
   `accounts-receivable` + las prefs de UI (gestionado) al mapper puro y compone la
   vista. Degradación honesta (dos modos según haya o no vencimientos del SII).
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en
   `cobrar-v2-map` (testeada) y las piezas presentacionales tienen sus stories. */

const ASUNTO = "Cobranza pendiente";

/** Fecha de HOY en America/Santiago como ISO "YYYY-MM-DD" (en-CA da ese formato). */
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function CobrarV2Live({ siiEnabled }: { siiEnabled: boolean }) {
  const query = useAccountsReceivable();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <QavanteInlineError
        error={query.error}
        what="las cuentas por cobrar"
        onRetry={() => query.refetch()}
      />
    );
  }
  const data = query.data;
  if (!data) return null;
  if (parseAmount(data.total) === 0) {
    return isSyncPending(data) ? (
      <SyncPendingState missingSources={data.missing_sources} what="tus cuentas por cobrar" />
    ) : (
      <QavanteEmpty
        title="No tienes cuentas por cobrar"
        description="Cuando tengas documentos por cobrar pendientes, vas a verlos acá ordenados por prioridad."
      />
    );
  }
  return <Assembled data={data} siiEnabled={siiEnabled} />;
}

function Assembled({
  data,
  siiEnabled,
}: {
  data: AccountsReceivableResponse;
  siiEnabled: boolean;
}) {
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();

  const gestionadoMap = React.useMemo(() => readGestionado(prefs.data?.preferences), [prefs.data]);
  const gestionadoDocsMap = React.useMemo(
    () => readGestionadoDocs(prefs.data?.preferences),
    [prefs.data],
  );
  // UNIFICACIÓN de las fuentes de cobranza: la fuente primaria es el RCV del año (la MISMA
  // base que "Clientes") — completo, por-documento, net de NC, con conciliado descontado y
  // el vencimiento DERIVADO del término. `accounts-receivable` queda como respaldo si el RCV
  // aún no cargó. Así Cobrar y Clientes muestran exactamente lo mismo, y el vencido derivado
  // enciende el modo urgencia (antes atascado en "concentración" esperando al SII).
  const ventasDocs = useMaestroDocs("ventas");
  const cps = React.useMemo(() => {
    if (ventasDocs.docs.length === 0) return [];
    const terminos = readTerminos(prefs.data?.preferences);
    const pagadosMap = readPagados(prefs.data?.preferences);
    return buildMaestro(ventasDocs.docs, terminos, "ventas", new Date(), pagadosMap);
  }, [ventasDocs.docs, prefs.data]);
  const useRcv = cps.length > 0;
  /* Docs por RUT para el panel expandido: los `DocMaestro` del maestro (folio + emisión + vencimiento
     DERIVADO + días de mora). Misma fuente que el vencido de la fila → los números cuadran, y sin un
     fetch aparte (antes era `useDebtorInvoices`, que traía RcvDoc crudo sin vencimiento). */
  const docsByRut = React.useMemo(() => {
    const m = new Map<string, DocMaestro[]>();
    for (const cp of cps) m.set(rutKey(cp.rut), cp.docs);
    return m;
  }, [cps]);
  const totalConciliado = React.useMemo(
    () => cps.reduce((s, cp) => s + Math.max(0, cp.pagado), 0),
    [cps],
  );

  // Deudores: del maestro RCV (por cobrar = facturado net NC − conciliado; vencido derivado)
  // o del accounts-receivable si el RCV no cargó (respaldo).
  const debtors: TopDebtor[] = React.useMemo(() => {
    if (useRcv) {
      // Solo los que AÚN deben (por cobrar > 0). Las contrapartes del maestro que quedaron en $0
      // —totalmente cobradas/conciliadas o con NC que anula la factura— no van en "a quién cobrarle"
      // (mostrarlas confunde: dicen "cóbrale a X" cuando X ya no debe). El directorio completo con los
      // $0 vive en la pantalla Clientes, no acá.
      return cps
        .filter((cp) => Math.round(cp.total - cp.pagado) > 0)
        .map((cp) => ({
          name: cp.name,
          rut: cp.rut,
          total: String(Math.max(0, cp.total - cp.pagado)),
          overdue: String(Math.max(0, cp.vencido)),
        }));
    }
    return data.top_debtors ?? [];
  }, [useRcv, cps, data.top_debtors]);

  const grandTotal = useRcv
    ? debtors.reduce((s, d) => s + parseAmount(d.total), 0)
    : parseAmount(data.total);
  /* Vencido: por la vía RCV se DERIVA localmente (siempre se conoce). Por la vía
     `accounts-receivable` puede venir `null` = la API no pudo computarlo
     (qavante-api#123, hallazgo H6) → se propaga el null, NO se aplasta a 0. Un `0`
     acá significa "estás al día" y tiene que seguir significando eso. */
  const totalVencido: number | null = useRcv
    ? /* `totalVencidoDeudores` y no un `reduce` con `parseAmount`: si el vencido de
       UN deudor no se sabe, la suma tampoco. El reduce viejo contaba esos como 0 y
       sub-reportaba la mora — el peor sentido en el que puede fallar una cifra de
       cobranza. */
      totalVencidoDeudores(debtors)
    : parseAmountOrNull(data.overdue);
  const overduePct =
    totalVencido == null ? null : grandTotal > 0 ? (totalVencido / grandTotal) * 100 : 0;
  const sinDato = explicarVencidoSinDato(data);

  /* ÚNICA fuente de verdad sobre si CONOCEMOS la mora agregada (H6-F).
     Por la vía RCV se deriva localmente → siempre se conoce. Por
     `accounts-receivable` lo dice el contrato (#123): `overdue: null` = no se pudo
     computar. NUNCA se infiere de una heurística del front del tipo "¿algún deudor
     tiene mora?": esa heurística vivía en dos lugares distintos (el resumen y el
     hero) y terminaba haciendo que la pantalla se contradijera a sí misma — el hero
     diciendo "aún no sabemos qué está vencido" y el resumen, más abajo, "Vencido $0
     · Estás al día". La causa del "no sé" sale del dato, y de un solo lugar. */

  const ordered = React.useMemo(
    () => sortDebtors(debtors, gestionadoMap),
    [debtors, gestionadoMap],
  );
  /* Orden de la LISTA de deudores. Por defecto (sortKey null) respeta el ranking
     curado de `ordered` (a quién cobrar primero); el usuario puede reordenar por
     nombre/monto/vencido/mora. El hero (la recomendación) NO se toca. */
  const debtorCols = React.useMemo<SortColumn<TopDebtor>[]>(
    () => [
      { key: "nombre", kind: "text", get: (d) => d.name },
      { key: "monto", kind: "number", get: (d) => parseAmount(d.total) },
      /* Desconocido → −1: en ESTA columna ordenable el "no se sabe" queda al final,
         porque el usuario que ordena por vencido está pidiendo montos. La urgencia
         real la resuelve `sortByUrgency`, que sí lo pone por encima de los ceros. */
      { key: "vencido", kind: "number", get: (d) => vencidoDeDeudor(d) ?? -1 },
      {
        key: "mora",
        kind: "number",
        get: (d) => peorMoraDias(docsByRut.get(rutKey(d.rut)) ?? []) ?? null,
      },
    ],
    [docsByRut],
  );
  const debtorSort = useTableSort(debtorCols, null);
  const displayed = debtorSort.sorted(ordered);
  const sortControl = (
    <SortBar
      options={[
        { key: "prioridad", label: "Prioridad" },
        { key: "vencido", label: "Vencido" },
        { key: "mora", label: "Mora" },
        { key: "monto", label: "Monto" },
        { key: "nombre", label: "Nombre" },
      ]}
      activeKey={debtorSort.sortKey ?? "prioridad"}
      dir={debtorSort.sortDir}
      onSelect={(key) => (key === "prioridad" ? debtorSort.reset() : debtorSort.toggle(key))}
    />
  );
  const pendientes = ordered.filter((d) => !isGestionado(gestionadoMap, d.rut));
  const prioridad = pickPrioridad({ ...data, top_debtors: pendientes });
  /* Qué puede AFIRMAR la pantalla sobre lo vencido. El ranking (`prioridad.mode`)
     entra como insumo del relato, pero NO decide la causa: eso sale del dato. */
  const relato = relatoVencido({ prioridadMode: prioridad?.mode ?? null, totalVencido });

  const [openRut, setOpenRut] = React.useState<string | null>(null);
  const [copiadoRut, setCopiadoRut] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Esperar a que carguen las PREFS (conciliaciones) antes de mostrar la lista: sin ellas,
  // `buildMaestro` trata TODOS los docs como impagos → contrapartes ya cobradas/conciliadas
  // aparecerían debiendo (race real cazada en prod: TEPILLE/TESTGROUP mostraban su factura ya
  // conciliada). Skeleton hasta que las prefs estén (o fallen).
  if (prefs.isLoading) return <LoadingSkeleton />;
  /* Mismo motivo que las prefs: mientras el maestro RCV está en vuelo, `cps` está
     vacío y `useRcv` da false, así que la pantalla caería a la vía
     `accounts-receivable` y podría afirmar una cosa ahora y otra medio segundo
     después. "Todavía no cargó" no puede ser indistinguible de "no hay datos".
     `isInitialLoading` y NO `isFetching`: este último también se enciende en los
     refetch de fondo (`refetchOnWindowFocus` está activo por defecto), así que un
     tenant con RCV genuinamente vacío veía la pantalla entera colapsar a skeleton
     cada vez que volvía a la pestaña. */
  if (ventasDocs.isInitialLoading) return <LoadingSkeleton />;

  const remFor = (d: TopDebtor) =>
    reminderText({
      name: d.name,
      total: parseAmount(d.total),
      /* Si no se sabe el vencido, el recordatorio va en modo CONCENTRACION y con 0:
         este texto se le manda al cliente, y afirmarle una mora que no verificamos
         es peor que no mencionarla. */
      overdue: vencidoDeDeudor(d) ?? 0,
      mode: (vencidoDeDeudor(d) ?? 0) > 0 ? "urgencia" : "concentracion",
    });

  const copiar = (d: TopDebtor) => {
    const text = remFor(d);
    const ok = () => {
      setCopiadoRut(rutKey(d.rut));
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiadoRut(null), 2000);
      toast.success("Recordatorio copiado", {
        description: "Pégalo en WhatsApp, correo o donde le escribas al cliente.",
      });
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(ok)
        .catch(() => toast.error("No pudimos copiar. Intenta de nuevo."));
    } else {
      toast.error("Tu navegador no permite copiar automáticamente.");
    }
  };

  const toggleGestionado = (d: TopDebtor) => {
    if (!prefs.isSuccess) {
      toast.error("No pudimos guardar", {
        description: "No cargaron tus preferencias; recarga e intenta de nuevo.",
      });
      return;
    }
    const already = isGestionado(gestionadoMap, d.rut);
    const blob = already
      ? withoutGestionado(prefs.data?.preferences, d.rut)
      : withGestionado(prefs.data?.preferences, d.rut, todayISO());
    updatePrefs.mutate(blob, {
      onSuccess: () =>
        toast.success(already ? `Reabriste a ${d.name}` : `Marcaste a ${d.name} como gestionado`),
      onError: () => toast.error("No pudimos guardar el cambio."),
    });
  };

  /* Gestionado por FACTURA (granular): marca/desmarca un documento aparte del deudor. */
  const toggleGestionadoDoc = (rut: string | null | undefined, folio: number | string | null) => {
    if (!prefs.isSuccess) {
      toast.error("No pudimos guardar", {
        description: "No cargaron tus preferencias; recarga e intenta de nuevo.",
      });
      return;
    }
    const already = isGestionadoDoc(gestionadoDocsMap, rut, folio);
    const blob = already
      ? withoutGestionadoDoc(prefs.data?.preferences, rut, folio)
      : withGestionadoDoc(prefs.data?.preferences, rut, folio, todayISO());
    updatePrefs.mutate(blob, {
      onError: () => toast.error("No pudimos guardar el cambio."),
    });
  };

  const hero = prioridad ? (
    <CobrarHero
      /* TODO el hero lee `relato.hero`, incluido el titular. Antes el titular leía
         `prioridad.mode` y la bajada `relato.hero`: hoy dan lo mismo, pero son dos
         idiomas para la misma condición y es exactamente la forma de la trampa que
         este PR vino a cerrar — el día que el relato cambie, el titular seguiría
         diciendo "Cóbrale primero a X · $3.000.000 vencido" con la bajada, debajo,
         diciendo "aún no sabemos qué está vencido". Una sola fuente. */
      antetitulo={relato.hero === "urgencia" ? "Cóbrale primero a" : "Tu mayor cobranza"}
      cliente={prioridad.debtor.name}
      rut={prioridad.debtor.rut ?? null}
      monto={relato.hero === "urgencia" ? prioridad.overdue : prioridad.total}
      montoLabel={relato.hero === "urgencia" ? "vencido" : "por cobrar"}
      montoTono={relato.hero === "urgencia" ? "danger" : "neutral"}
      bajada={
        relato.hero === "urgencia" ? (
          <>
            De {formatClp(prioridad.total)} que te debe. Es tu cobranza vencida más grande, pártele
            por acá.
          </>
        ) : relato.hero === "sin-dato" ? (
          <>
            {formatPct(prioridad.pctDelTotal)} de tus {formatClp(grandTotal)} por cobrar. Aún no
            sabemos qué está vencido, así que priorizamos por tamaño. {sinDato.motivo}
          </>
        ) : (
          <>
            {formatPct(prioridad.pctDelTotal)} de tus {formatClp(grandTotal)} por cobrar. Nada
            vencido entre lo pendiente por ahora, así que priorizamos por el tamaño de la deuda.
          </>
        )
      }
      infoHint={
        relato.hero === "urgencia"
          ? "Priorizamos por mora derivada del término de pago (emisión + término). Ajusta los términos por cliente en Clientes."
          : relato.hero === "sin-dato"
            ? sinDato.accion
            : "Los vencimientos se derivan del término de pago (emisión + término). Cuando algo entre en mora, la pantalla prioriza por lo vencido."
      }
      acciones={
        <CobranzaAcciones
          onCopiar={() => copiar(prioridad.debtor)}
          copiado={copiadoRut === rutKey(prioridad.debtor.rut)}
          waHref={waHref(remFor(prioridad.debtor))}
          mailtoHref={mailtoHref(ASUNTO, remFor(prioridad.debtor))}
          gestionado={gestionadoMap[rutKey(prioridad.debtor.rut)] ?? null}
          onToggleGestionado={() => toggleGestionado(prioridad.debtor)}
          gestionadoPending={updatePrefs.isPending}
        />
      }
    />
  ) : (
    <TodoGestionado count={debtors.length} />
  );

  const deudores = (
    <ul className="divide-y divide-border">
      {displayed.map((d) => {
        const rut = rutKey(d.rut);
        const text = remFor(d);
        return (
          <DeudorRow
            key={rut || d.name}
            name={d.name}
            rut={d.rut ?? null}
            total={parseAmount(d.total)}
            overdue={vencidoDeDeudor(d)}
            pct={grandTotal > 0 ? (parseAmount(d.total) / grandTotal) * 100 : 0}
            gestionado={gestionadoMap[rut] ?? null}
            onCopiar={() => copiar(d)}
            copiado={copiadoRut === rut}
            waHref={waHref(text)}
            mailtoHref={mailtoHref(ASUNTO, text)}
            onToggleGestionado={() => toggleGestionado(d)}
            gestionadoPending={updatePrefs.isPending}
            isOpen={openRut === rut}
            onToggleOpen={() => setOpenRut(openRut === rut ? null : rut)}
            docs={docsByRut.get(rut) ?? []}
            gestionadoDocs={gestionadoDocsMap}
            onToggleDoc={(folio) => toggleGestionadoDoc(d.rut, folio)}
          />
        );
      })}
    </ul>
  );

  return (
    <CobrarV2View
      hero={hero}
      sortControl={sortControl}
      resumen={
        <ResumenCobranza
          total={grandTotal}
          overdue={totalVencido}
          overduePct={overduePct}
          conciliado={totalConciliado}
          sinDato={sinDato}
        />
      }
      aging={useRcv ? undefined : agingBreakdown(data.aging)}
      agingSinDato={sinDato}
      deudores={deudores}
      banner={
        !useRcv && isPartial(data) ? (
          <PartialDataBanner missingSources={data.missing_sources} />
        ) : undefined
      }
      siiEnabled={siiEnabled}
    />
  );
}

function TodoGestionado({ count }: { count: number }) {
  return (
    <div className="p-5">
      <p className="flex items-center gap-2 text-[15px] font-bold text-success-700">
        <CircleCheck className="size-5" aria-hidden="true" />
        Gestionaste toda tu cobranza
      </p>
      <p className="mt-1.5 text-[12.5px] text-neutral-mid">
        Marcaste como gestionados a tus {count} clientes con saldo. Reabre cualquiera abajo si
        necesitas volver a insistir.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
