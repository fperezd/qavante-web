"use client";

import * as React from "react";
import { useDeferredDocuments } from "@/lib/api/document-actions";
import {
  useAccountsPayable,
  usePayableDuplicateAnomalies,
  type AccountsPayableQuery,
} from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/errors";
import { PagarV05View } from "./pagar-v05-view";
import {
  queryFiltroServidor,
  type FiltroServidorV05,
  type PagarHorizonte,
} from "./pagar-v05-model";
import { CashProjectionRunPanel } from "@/components/cash-projection-runs/cash-projection-run-panel";

/* Cableado de V05 · Pagar. La vista es presentacional; acá se resuelve la ÚNICA fuente de cifras:
 *
 *   · `GET /api/treasury/accounts-payable` — total, tramos `due_*`, ítems con fecha (tope 100),
 *     lo sin fecha (`undated_*`), caja proyectada a 14 días con su moneda, y `missing_sources`.
 *     Es la MISMA fuente que "Sale · 14 días" en V02 · Caja (Ley 1).
 *
 * Los documentos en seguimiento (`useDeferredDocuments`) NO son una segunda fuente de cifras:
 * sólo ocultan filas de la página que el dueño marcó, y no entran en ningún agregado.
 *
 * A propósito NO se mezclan acá los maestros RCV de compras/honorarios que usa Pagar v2 (flag
 * `pagarV2`, OFF): combinar dos fuentes daría un "Vencido" distinto del que se puede derivar del
 * endpoint canónico, y la Ley 1 pide un concepto = un número = una fuente. Lo que el endpoint no
 * lista, la vista lo DECLARA (sin fecha, tope, monedas sin TC) en vez de completarlo por otro
 * camino. */

/** Por qué no llegó el registro, en lenguaje de dueño. */
export function motivoSinPagos(err: unknown): string {
  if (err instanceof ApiError && err.code === "incompatible_accounts_payable_contract") {
    return "El servicio de pagos está en una versión anterior. No mostramos cifras ni filtros parciales.";
  }
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el registro de pagos (error de red). Vuelve a intentar en un momento.";
  }
  return "El registro de pagos no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

export function debeReiniciarCursor(
  error: unknown,
  cursor: string | undefined,
  ultimoReiniciado: string | null,
): cursor is string {
  return (
    Boolean(cursor) &&
    error instanceof ApiError &&
    error.status === 422 &&
    error.code === "invalid_cursor" &&
    ultimoReiniciado !== cursor
  );
}

export function PagarV05Live({
  suppressRecommendations = false,
}: {
  /** El brief server-owned ya ocupa la decisión principal; V05 conserva evidencia y tabla. */
  suppressRecommendations?: boolean;
} = {}) {
  const [hoy] = React.useState(() => new Date());
  const [filtro, setFiltro] = React.useState<FiltroServidorV05>("todos");
  const [horizonte, setHorizonte] = React.useState<PagarHorizonte>(7);
  const [consulta, setConsulta] = React.useState("");
  const [busqueda, setBusqueda] = React.useState("");
  const [cursores, setCursores] = React.useState<string[]>([]);
  const [cursorAviso, setCursorAviso] = React.useState<string | null>(null);
  const [asOf, setAsOf] = React.useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()),
  );
  const cursorReiniciado = React.useRef<string | null>(null);
  const cursor = cursores.at(-1);
  const query: AccountsPayableQuery = {
    limit: 100,
    ...queryFiltroServidor(filtro, asOf),
    ...(busqueda ? { search: busqueda } : {}),
    ...(cursor ? { cursor } : {}),
  };
  const ap = useAccountsPayable(query);
  const deferred = useDeferredDocuments("payable");
  const anomalias = usePayableDuplicateAnomalies();

  React.useEffect(() => {
    if (ap.data?.as_of) setAsOf(ap.data.as_of);
  }, [ap.data?.as_of]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusqueda(consulta.trim());
      setCursores([]);
      setCursorAviso(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [consulta]);

  React.useEffect(() => {
    if (debeReiniciarCursor(ap.error, cursor, cursorReiniciado.current)) {
      cursorReiniciado.current = cursor;
      setCursores([]);
      setCursorAviso("Los datos cambiaron; volvimos una vez a la primera página.");
    }
  }, [ap.error, cursor]);

  React.useEffect(() => {
    if (ap.isSuccess) cursorReiniciado.current = null;
  }, [ap.isSuccess]);

  if (ap.isLoading || deferred.isLoading) return <CargandoPagar />;

  return (
    <>
      {deferred.isError && (
        <p role="alert" className="mb-3 text-sm">
          No pudimos cargar los seguimientos. Se muestran todos los documentos.{" "}
          <button onClick={() => void deferred.refetch()} className="underline">
            Reintentar
          </button>
        </p>
      )}
      <PagarV05View
        deferredIds={deferred.data?.document_ids}
        pagos={ap.data ?? null}
        pagosMotivo={ap.isError ? motivoSinPagos(ap.error) : null}
        anomalias={anomalias.isSuccess ? anomalias.data.items : null}
        anomaliasMotivo={
          anomalias.isError
            ? "No pudimos revisar posibles duplicados; no los estamos descartando."
            : anomalias.isLoading
              ? "Estamos revisando posibles duplicados."
              : null
        }
        onReintentar={() => {
          void ap.refetch();
          void anomalias.refetch();
        }}
        hoy={hoy}
        filtro={filtro}
        consulta={consulta}
        pagina={cursores.length + 1}
        cursorAviso={cursorAviso}
        cargandoPagina={ap.isFetching}
        horizonte={horizonte}
        onHorizonteChange={(next) => {
          setHorizonte(next);
        }}
        onFiltroChange={(next) => {
          setFiltro(next);
          setCursores([]);
          setCursorAviso(null);
        }}
        onConsultaChange={setConsulta}
        onAnterior={
          cursores.length > 0 ? () => setCursores((prev) => prev.slice(0, -1)) : undefined
        }
        onSiguiente={
          ap.data?.next_cursor
            ? () => {
                setCursores((prev) => [...prev, ap.data!.next_cursor!]);
                setCursorAviso(null);
              }
            : undefined
        }
        canonicalProjection={
          <CashProjectionRunPanel horizonDays={14} title="Caja para decidir pagos" />
        }
        suppressRecommendations={suppressRecommendations}
      />
    </>
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoPagar() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tus cuentas por pagar y sus vencimientos.
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
