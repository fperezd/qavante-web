"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  DEBTORS_PAGE_SIZE,
  type ReceivableDebtor,
  type ReceivableDebtorCurrencyTotal,
  type ReceivableDebtorsParams,
  type ReceivableRankingBridge,
  esCorteVencido,
  useReceivableDebtors,
} from "@/lib/api/cobranza";
import { useCompanyScope } from "@/components/shell/company-scope";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { MONTO_EN_REVISION, importeDesconocido } from "@/lib/formatters/amount";
import { concordar, formatCount } from "@/lib/formatters/count";
import { formatDateTimeLike } from "@/lib/formatters/date";
import { esIdentidadDebil } from "@/lib/validators/rut";
import { cn } from "@/lib/utils";

/* ── Directorio operativo de deudores, no un ranking ────────────────────────────────────────
 *
 * EL DEFECTO QUE ESTO CIERRA (issue #207, medido en producción):
 *
 * La cartera de Cobrar se armaba desde `top_debtors`, que es un top 5, y encima de esas cinco
 * filas la pantalla hacía la búsqueda y la paginación EN MEMORIA. Dos consecuencias, las dos
 * mentiras y ninguna visible:
 *
 *   1. Un deudor fuera del top era inalcanzable por construcción. El caso del issue es un
 *      VOLCAN de $13.300: escribir "VOLCAN" en el buscador filtraba cinco filas que no lo
 *      contenían y la pantalla contestaba "no hay resultados" sobre una cartera que sí lo
 *      tenía. No era un dato faltante: era una búsqueda que nunca preguntó.
 *   2. El conteo salía de `.length` sobre esa misma lista, así que el rótulo
 *      "N clientes con saldo" decía 5 teniendo 200. El propio código tenía escrito, siete
 *      líneas más abajo, "`top_debtors` es un top, no la cartera entera" — el conocimiento
 *      estaba ahí, aplicado al monto del pie y no al conteo.
 *
 * ACÁ NO HAY NI UN `.length` QUE SE PUBLIQUE COMO CONTEO DE CARTERA. El conteo de deudores es
 * `items_total` del servidor ("deudores que cumplen los filtros, sin paginar"). El `.length` de
 * las filas cargadas aparece una sola vez y rotulado como lo que es: cuántas filas se
 * alcanzaron a traer de ese total.
 *
 * Y EL RESTO TIENE NOMBRE Y MONTO. `ranking_bridge[]` publica por moneda `top_five_total`,
 * `directory_total`, `remainder_total` y `debtor_count`: el servidor dice cuánto es el top 5 y
 * cuánto es el resto, así que la pantalla lo dice con esas palabras en vez de dejar el resto
 * fuera de cuadro.
 *
 * MONEDAS: nunca se suman entre sí. Cada moneda es su propia línea, acá y en cada fila. El
 * contrato entrega los totales por moneda precisamente para que la pantalla no invente un tipo
 * de cambio.
 */

const ESTADOS: { id: NonNullable<ReceivableDebtorsParams["state"]>; label: string }[] = [
  { id: "collectable", label: "Cobrable" },
  { id: "credit", label: "Notas de crédito" },
  { id: "ceded", label: "Cedidas" },
  { id: "all", label: "Todo junto" },
];

const ORDENES: { id: NonNullable<ReceivableDebtorsParams["sort"]>; label: string }[] = [
  { id: "total_desc", label: "Mayor saldo primero" },
  { id: "document_count_desc", label: "Más documentos primero" },
  { id: "name_asc", label: "Nombre (A-Z)" },
  { id: "name_desc", label: "Nombre (Z-A)" },
];

/** "7 clientes", "1 cliente". Compone los dos helpers que ya existen (`formatCount` para el
 *  separador de miles, `concordar` para el singular) en vez de reescribir ninguno de los dos:
 *  el propio `count.ts` cuenta que ese ternario llegó a estar duplicado idéntico en SEIS
 *  archivos y que de ahí salió el "Los 1 proveedores". Acá no va la séptima copia. */
export function contar(n: number, singular: string, plural: string): string {
  return `${formatCount(n)} ${concordar(n, singular, plural)}`;
}

/** Saldo de una moneda. Devuelve la ausencia NOMBRADA, nunca un cero fabricado:
 *  - importe en cuarentena de conciliación → "En revisión" (es el rótulo del resto de la app).
 *  - moneda que el origen no permite determinar → se dice eso, con los documentos que la
 *    componen, porque sin moneda no hay cifra que escribir.
 *  El cero VERIFICADO sí se escribe como cero: lo distingue el `total` presente. */
export function montoDeMoneda(total: ReceivableDebtorCurrencyTotal): string {
  if (importeDesconocido(total)) {
    return `${MONTO_EN_REVISION} en ${contar(total.document_count, "documento", "documentos")}`;
  }
  if (total.currency_status === "unknown" || total.currency == null) {
    return `${contar(total.document_count, "documento", "documentos")} cuya moneda no viene en el origen`;
  }
  return formatMoneyFromDecimalString(total.total, total.currency) ?? total.total ?? "";
}

/** Vencido de una moneda, o la razón de que no haya cifra. `null` NO es cero: el contrato dice
 *  que es "moneda desconocida" o "sólo documentos sin vencimiento". */
export function vencidoDeMoneda(total: ReceivableDebtorCurrencyTotal): string {
  if (importeDesconocido(total)) return MONTO_EN_REVISION;
  if (total.overdue != null) {
    return formatMoneyFromDecimalString(total.overdue, total.currency) ?? total.overdue;
  }
  if (total.undated_document_count > 0 && total.undated_document_count === total.document_count) {
    return "Todo sin fecha de vencimiento";
  }
  if (total.currency_status === "unknown" || total.currency == null) {
    return "Moneda sin determinar en el origen";
  }
  return "Nada vencido";
}

/** Documentos de un deudor, sumando el `document_count` que el servidor publica por moneda.
 *  Son conteos, no montos: sumarlos entre monedas no inventa ningún tipo de cambio. */
export function documentosDe(deudor: ReceivableDebtor): number {
  return deudor.totals.reduce((acc, total) => acc + total.document_count, 0);
}

/** Qué va en la celda RUT de una fila.
 *
 *  LA FILA ES EL `counterparty_key`, NO EL RUT. Esta pantalla ya agrupa por el UUID canónico
 *  que publica el contrato (`ReceivableDebtor.counterparty_key`, requerido), así que diez
 *  clientes extranjeros son diez filas. Pero la celda imprimía `tax_id` crudo, y para un
 *  extranjero el SII no manda `null`: manda el centinela `55.555.555-5` PARA TODOS. O sea las
 *  diez filas mostraban el mismo RUT en la columna que el lector usa justamente para
 *  distinguirlas, y cada una lo exhibía como si la identificara.
 *
 *  `esIdentidadDebil` es el MISMO helper con que el Libro, el maestro, Contraparte 360 y el
 *  drill-down de Cobrar ya dejaron de tratar el centinela como identidad; acá se porta la
 *  decisión a la celda. La frase es la que ya usa el maestro de contrapartes
 *  (`maestro-view.tsx:318`), para que no haya dos redacciones del mismo hecho.
 *
 *  No se oculta nada ni se deja la celda muda: se dice qué es esa fila. Quien distingue a estos
 *  clientes es el nombre de la columna de al lado, y el `counterparty_key` por debajo. PURO. */
export function rutDeFila(deudor: ReceivableDebtor): string {
  if (esIdentidadDebil(deudor.tax_id)) return "cliente extranjero o sin RUT";
  return deudor.tax_id as string;
}

export interface LineaPuente {
  clave: string;
  texto: string;
}

/** La frase del issue, armada con los campos del contrato y sin un solo cálculo propio:
 *  "esto es el top 5 de N, el resto son $X". Una línea POR MONEDA; nada se suma entre monedas.
 *
 *  Se omite la moneda cuyo puente no tiene cifras que comparar (montos en cuarentena o moneda
 *  indeterminada): ahí el puente no diría nada verdadero. Lo que NO se omite nunca es un
 *  `remainder_total` presente, ni cuando es cero: "el resto son $0" sobre un directorio de
 *  cinco deudores es información, y es justamente la que faltaba. */
export function lineasDelPuente(bridge: ReceivableRankingBridge[]): LineaPuente[] {
  return bridge.flatMap((puente) => {
    const clave = puente.currency ?? `sin-moneda-${puente.debtor_count}`;
    if (importeDesconocido(puente) || puente.currency_status === "unknown" || !puente.currency) {
      return [];
    }
    const top = formatMoneyFromDecimalString(puente.top_five_total, puente.currency);
    const directorio = formatMoneyFromDecimalString(puente.directory_total, puente.currency);
    const resto = formatMoneyFromDecimalString(puente.remainder_total, puente.currency);
    if (top == null || directorio == null || resto == null) return [];

    const restantes = Math.max(puente.debtor_count - puente.top_limit, 0);
    // Cuando el directorio entero cabe en el top no hay "resto" que nombrar: decirlo igual
    // ("los otros 0 deudores") sería ruido que simula una cola que no existe.
    if (restantes === 0) {
      return [
        {
          clave,
          texto: `En ${puente.currency}, los ${contar(puente.debtor_count, "deudor", "deudores")} del directorio suman ${directorio}. Caben completos en los ${puente.top_limit} mayores.`,
        },
      ];
    }
    return [
      {
        clave,
        texto: `En ${puente.currency}, los ${puente.top_limit} mayores concentran ${top} de los ${directorio} que deben ${contar(puente.debtor_count, "deudor", "deudores")}. Los otros ${formatCount(restantes)} suman ${resto}.`,
      },
    ];
  });
}

/** El rótulo del conteo. Es función pura y vive separada del render a propósito: es LA cifra que
 *  el defecto escribía mal, así que se prueba sola, sin montar la tabla.
 *
 *  `total` es siempre `items_total` del servidor. Nunca llega acá un `.length`.
 *
 *  Y nunca sale un número sin decir qué cubre: con búsqueda, que se buscó en toda la cartera y
 *  no sólo entre los mayores (que es justamente lo que antes no era cierto); sin búsqueda, en
 *  qué estado se está contando, porque "clientes con saldo" cambia según si se cuentan las
 *  notas de crédito y las cedidas. */
export function textoDelConteo(total: number, busqueda: string, estadoLabel: string): string {
  if (busqueda) {
    return `${contar(total, "cliente coincide", "clientes coinciden")} con «${busqueda}» en toda la cartera, no sólo entre los mayores.`;
  }
  return `${contar(total, "cliente", "clientes")} con saldo en «${estadoLabel}».`;
}

/** El pie. El único lugar de la pantalla donde se publica un `.length`, y va rotulado como lo
 *  que es: cuántas filas se alcanzaron a traer del total que el servidor informó. Todo otro
 *  número de esta vista —el conteo de deudores, los documentos por fila, el puente— sale de un
 *  campo del contrato. */
export function textoDelPie(filasCargadas: number, total: number | null): string {
  const filas = contar(filasCargadas, "fila traída", "filas traídas");
  if (total == null) return `${filas}.`;
  return `${filas} de ${contar(total, "cliente con saldo", "clientes con saldo")}.`;
}

/* El corte se muestra CON HORA, con el mismo `formatDateTimeLike` que el resto de la app usa
   para "última sincronización". La hora no es un adorno: un `as_of` sin hora hace que dos cortes
   del mismo día se lean como el mismo dato, y ahí es donde un movimiento del día se esconde.
   Formatear acá a mano habría sido un séptimo formato de fecha; el gate del rediseño (§5.8) lo
   marca y tiene razón. */

function useDebounced<T>(value: T, ms: number): T {
  const [slow, setSlow] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setSlow(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return slow;
}

export function DirectorioDeudores() {
  const { activeCompanyId } = useCompanyScope();
  const [consulta, setConsulta] = React.useState("");
  const [estado, setEstado] =
    React.useState<NonNullable<ReceivableDebtorsParams["state"]>>("collectable");
  const [orden, setOrden] =
    React.useState<NonNullable<ReceivableDebtorsParams["sort"]>>("total_desc");
  /* La consulta que viaja al servidor va con retardo; la del input es inmediata. Sin esto cada
     tecla sería una consulta nueva (clave nueva) y una página 1 nueva. */
  const busqueda = useDebounced(consulta.trim(), 350);

  const params = React.useMemo<ReceivableDebtorsParams>(
    () => ({ search: busqueda, state: estado, sort: orden, limit: DEBTORS_PAGE_SIZE }),
    [busqueda, estado, orden],
  );
  const query = useReceivableDebtors(activeCompanyId, params);

  const paginas = query.data?.pages ?? [];
  const primera = paginas[0];
  const filas: ReceivableDebtor[] = paginas.flatMap((page) => page.items);
  /* El botón se decide por `hasNextPage`, NO por `has_more` de la última página. Son lo mismo
     mientras el servidor cumpla el contrato, y distintos justo cuando no: con `has_more: true`
     y `next_cursor: null`, `has_more` pintaría un botón que al apretarlo no trae nada. Un
     control que no hace lo que ofrece es peor que no estar. */
  const quedanMas = query.hasNextPage;

  if (!activeCompanyId) {
    return (
      <Marco>
        <p className="p-10 text-center text-sm text-neutral-mid">
          Elige una Empresa arriba y acá aparece su directorio de clientes con saldo.
        </p>
      </Marco>
    );
  }

  /* El 409 del contrato NO es "no hay deudores": es "el corte que estabas leyendo cambió, o el
     grafo de identidades perdió cobertura". El endpoint falla cerrada antes que publicar un
     directorio parcial, así que mostrar una tabla vacía acá sería convertir una ausencia en la
     afirmación "no te deben nada". El 422 (cursor incompatible) se resuelve igual: recargar. */
  if (esCorteVencido(query.error)) {
    return (
      <Marco>
        <div className="space-y-3 p-10 text-center">
          <p className="text-sm text-neutral-dark">
            El corte cambió mientras lo leías, así que esta lista quedó atrás. El directorio se
            publica completo o no se publica: el servidor prefiere pedirte otro corte antes que
            mostrarte una parte sin avisar.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Traer el corte nuevo
          </button>
        </div>
      </Marco>
    );
  }

  if (query.isError) {
    return (
      <Marco>
        <div className="space-y-3 p-10 text-center">
          <p className="text-sm text-neutral-dark">
            No alcanzamos a leer el directorio de clientes con saldo en este intento.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </Marco>
    );
  }

  const total = primera?.items_total ?? null;
  const puente = primera ? lineasDelPuente(primera.ranking_bridge) : [];

  return (
    <Marco>
      <header className="space-y-2 border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-dark">Clientes con saldo</h2>
          {primera && (
            <p className="text-xs text-neutral-mid">Corte al {formatDateTimeLike(primera.as_of)}</p>
          )}
        </div>
        {/* EL CONTEO. Sale de `items_total` —"deudores que cumplen los filtros, sin paginar"—
            y nunca de las filas cargadas. Y dice de qué está hecho: con búsqueda activa,
            cuántos coinciden; sin búsqueda, cuántos tienen saldo en el estado elegido. */}
        {total != null && (
          <p className="text-sm text-neutral-dark">
            {textoDelConteo(total, busqueda, ESTADOS.find((e) => e.id === estado)?.label ?? "")}
          </p>
        )}
        {puente.map((linea) => (
          <p key={linea.clave} className="text-xs text-neutral-mid">
            {linea.texto}
          </p>
        ))}
      </header>

      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[16rem] flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden
            />
            <span className="sr-only">Buscar un cliente en toda la cartera</span>
            <input
              type="search"
              value={consulta}
              onChange={(event) => setConsulta(event.target.value)}
              placeholder="Buscar por nombre o RUT en toda la cartera"
              className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-mid">
            <span>Orden</span>
            <select
              value={orden}
              onChange={(event) =>
                setOrden(event.target.value as NonNullable<ReceivableDebtorsParams["sort"]>)
              }
              className="h-10 rounded-lg border border-border bg-surface px-2 text-sm text-neutral-dark"
            >
              {ORDENES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* Créditos y cedidas van SEPARADOS, no mezclados en el saldo cobrable: son plata que
            se comporta distinto y sumarla al cobrable infla lo que se puede cobrar. */}
        <div className="flex flex-wrap rounded-lg border border-border bg-surface">
          {ESTADOS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              role="radio"
              aria-checked={estado === filtro.id}
              onClick={() => setEstado(filtro.id)}
              className={cn(
                "flex min-h-10 items-center border-r border-border px-3 text-xs font-medium text-neutral-mid last:border-r-0 hover:bg-neutral-50",
                estado === filtro.id && "bg-brand-primary-50 font-semibold text-brand-primary",
              )}
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <p className="p-10 text-center text-sm text-neutral-mid">
          Trayendo el directorio de clientes con saldo…
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold text-neutral-mid">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">RUT</th>
                  <th className="px-3 py-2 text-right">Documentos</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">Vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filas.map((deudor) => (
                  <tr key={deudor.counterparty_key}>
                    <td className="px-3 py-3 font-medium text-neutral-dark">{deudor.name}</td>
                    <td className="px-3 py-3 text-neutral-mid">
                      {/* Un RUT ausente se nombra; no se deja la celda muda ni se inventa. Y el
                          centinela de extranjero tampoco se imprime como si fuera un RUT: ver
                          `rutDeFila`. La fila la identifica `counterparty_key`, no esta celda. */}
                      {rutDeFila(deudor)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-mid">
                      {/* El conteo que publica el SERVIDOR (`document_count` por moneda), no el
                          largo de `receivable_ids`. Hoy coinciden; si algún día el contrato
                          acotara ese arreglo, el `.length` se convertiría en la misma mentira
                          que este PR viene a sacar, y en silencio. Sumar conteos entre monedas
                          sí es legítimo: son documentos, no plata. */}
                      {formatCount(documentosDe(deudor))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {/* Una línea por moneda. Nunca una suma entre monedas. */}
                      <div className="flex flex-col items-end gap-0.5 font-semibold tabular-nums text-neutral-dark">
                        {deudor.totals.map((total, i) => (
                          <span key={`${total.currency ?? "sin-moneda"}-${i}`}>
                            {montoDeMoneda(total)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums text-neutral-mid">
                        {deudor.totals.map((total, i) => (
                          <span key={`${total.currency ?? "sin-moneda"}-${i}`}>
                            {vencidoDeMoneda(total)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filas.length === 0 && (
            <p className="p-10 text-center text-sm text-neutral-mid">
              {busqueda
                ? `Buscamos «${busqueda}» en toda la cartera, no sólo en los mayores, y ningún cliente con saldo coincide.`
                : "Ningún cliente tiene saldo en este corte."}
            </p>
          )}

          {/* EL PIE. `filas.length` aparece acá, y es el único `.length` que se PUBLICA: dice
              cuántas filas se trajeron de `items_total`, que es otra cosa que "cuántos hay".
              Mientras queden páginas, el botón las trae del SERVIDOR; antes el "ver más" no
              existía porque no había nada más que ver: la lista venía topeada en cinco. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-neutral-mid">
            <span>{textoDelPie(filas.length, total)}</span>
            {quedanMas && (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-brand-primary disabled:opacity-60"
              >
                {query.isFetchingNextPage
                  ? "Trayendo más clientes…"
                  : `Traer ${DEBTORS_PAGE_SIZE} clientes más`}
              </button>
            )}
          </div>
        </>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-surface">{children}</section>;
}
