"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  ReceiptText,
} from "lucide-react";
import {
  MaquetaPeriodoSelector,
  etiquetaPeriodo as etiquetaDePeriodo,
  periodoDeVentana,
  type MaquetaPeriodo,
} from "./maqueta-periodo";
import { buildDemoCashProjection } from "@/lib/demo/projection-data";
import {
  DEMO_CASH_FLOW_TRANSACTIONS,
  DEMO_CURRENT_BALANCE,
  DEMO_CUSTOMER_SALE,
  DEMO_OVERDUE_RECEIVABLES,
  DEMO_UNDATED_RECEIVABLE,
} from "@/lib/demo/cash-flow-data";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { periodoLargo } from "@/lib/formatters/months";

type VistaCobros = "pendientes" | "vencidos" | "cobrados";
type Horizonte = 7 | 14 | 30 | 90;
type CobroAbierto = {
  id: string;
  date: string | null;
  label: string;
  customerName: string;
  customerRut?: string;
  documentReference?: string;
  amount: number;
  classification: string;
};

const DETALLES_COBROS_PENDIENTES: Record<
  string,
  { customerName: string; customerRut: string; documentReference: string }
> = {
  "Cobro esperado · servicio de soporte": {
    customerName: "Comercial Los Aromos SpA",
    customerRut: "77.234.567-4",
    documentReference: "Por emitir · factura o boleta según la venta",
  },
  "Cobro programado · nuevo servicio a cliente": {
    customerName: "Distribuidora del Sur SpA",
    customerRut: "76.234.567-6",
    documentReference: "Por emitir · factura o boleta según la venta",
  },
  "Cobro programado · proyecto para cliente": {
    customerName: "Inversiones Santa Elena Ltda.",
    customerRut: "77.456.789-5",
    documentReference: "Por emitir · factura o boleta según la venta",
  },
};

const DETALLES_COBROS_REALIZADOS: Record<
  string,
  { cliente: string; rut: string; documento: string }
> = {
  [`customer-collection-33-${DEMO_CUSTOMER_SALE.folio}`]: {
    cliente: DEMO_CUSTOMER_SALE.customerName,
    rut: DEMO_CUSTOMER_SALE.customerRut,
    documento: `Factura electrónica N.º ${DEMO_CUSTOMER_SALE.folio}`,
  },
  "demo-paid-internet-2026-09-15": {
    cliente: "Comercial Los Aromos SpA",
    rut: "77.234.567-4",
    documento: "Factura electrónica N.º 10006",
  },
  "demo-collected-infrastructure-2026-08-04": {
    cliente: "Inversiones Santa Elena Ltda.",
    rut: "77.456.789-5",
    documento: "Factura electrónica N.º 10007",
  },
  "demo-collected-administration-2026-07-22": {
    cliente: "Servicios Andinos Ltda.",
    rut: "76.543.210-3",
    documento: "Factura electrónica N.º 10008",
  },
  "demo-collected-training-2026-07-09": {
    cliente: "Consumidor final",
    rut: "Consumidor final",
    documento: "Boleta electrónica N.º 10009",
  },
};

const HORIZONTES: Horizonte[] = [7, 14, 30, 90];
export function CobrosMaqueta() {
  const [today] = React.useState(() => new Date());
  const [vista, setVista] = React.useState<VistaCobros>("pendientes");
  const [periodo, setPeriodo] = React.useState<MaquetaPeriodo>(() => defaultPeriod(today));
  const [horizonte, setHorizonte] = React.useState<Horizonte>(7);

  React.useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("vista");
    if (
      requestedView === "pendientes" ||
      requestedView === "vencidos" ||
      requestedView === "cobrados"
    ) {
      setVista(requestedView);
    }
  }, []);

  function cambiarVista(next: VistaCobros) {
    setVista(next);
    const params = new URLSearchParams(window.location.search);
    params.set("vista", next);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }

  const { desde, hasta } = dateRange(periodo, today);
  const cobrosRecibidos = DEMO_CASH_FLOW_TRANSACTIONS.filter(
    (movement) =>
      Number(movement.inflow) > 0 &&
      movement.classification === "Clientes" &&
      movement.date >= desde &&
      movement.date <= hasta,
  ).sort((a, b) => b.date.localeCompare(a.date));
  const etiquetaPeriodo = etiquetaDePeriodo(periodo);
  const proyeccion = buildDemoCashProjection(horizonte, Number(DEMO_CURRENT_BALANCE), today, true);
  const cobrosPendientes = (proyeccion.demo_movements ?? []).filter(
    (movement) => movement.type === "cobranza" && movement.amount > 0,
  );
  const cobrosAbiertos: CobroAbierto[] = [
    ...cobrosPendientes.map((movement, index) => {
      const detalle = DETALLES_COBROS_PENDIENTES[movement.label];
      return {
        id: `proyeccion-${index}-${movement.date}`,
        date: movement.date,
        label: movement.label,
        customerName: detalle?.customerName ?? DEMO_CUSTOMER_SALE.customerName,
        customerRut: detalle?.customerRut ?? DEMO_CUSTOMER_SALE.customerRut,
        documentReference:
          detalle?.documentReference ?? `Por emitir · factura o boleta según la venta`,
        amount: movement.amount,
        classification: "Clientes",
      };
    }),
    {
      id: DEMO_UNDATED_RECEIVABLE.id,
      date: null,
      label: "Cobro por asesoría mensual",
      customerName: DEMO_UNDATED_RECEIVABLE.customerName,
      customerRut: "76.234.567-6",
      documentReference: "Por emitir · factura o boleta según la venta",
      amount: DEMO_UNDATED_RECEIVABLE.amount,
      classification: DEMO_UNDATED_RECEIVABLE.classification,
    },
  ];
  const cobrosVencidos: CobroAbierto[] = DEMO_OVERDUE_RECEIVABLES.map((receivable) => ({
    id: receivable.id,
    date: localDateKey(offsetDate(today, -receivable.daysOverdue)),
    label: receivable.label,
    customerName: receivable.customerName,
    customerRut: receivable.customerRut,
    documentReference: receivable.invoiceReference,
    amount: receivable.amount,
    classification: receivable.classification,
  })).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const limitePendientes = localDateKey(offsetDate(today, horizonte));
  const pendientesEnHorizonte = cobrosAbiertos
    .filter((movement) => movement.date === null || movement.date <= limitePendientes)
    .sort((a, b) => {
      if (a.date === null) return b.date === null ? 0 : 1;
      if (b.date === null) return -1;
      return a.date.localeCompare(b.date);
    });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-dark">Cobros</h1>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-neutral-dark hover:border-brand-primary/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al inicio
        </Link>
      </header>

      <div aria-label="Tipo de cobros" className="flex gap-2" role="group">
        <TabButton active={vista === "pendientes"} onClick={() => cambiarVista("pendientes")}>
          Pendientes
        </TabButton>
        <TabButton active={vista === "vencidos"} onClick={() => cambiarVista("vencidos")}>
          Vencidos
        </TabButton>
        <TabButton active={vista === "cobrados"} onClick={() => cambiarVista("cobrados")}>
          Realizados
        </TabButton>
      </div>

      {vista === "cobrados" ? (
        <RecibidosView
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          cobros={cobrosRecibidos}
          etiquetaPeriodo={etiquetaPeriodo}
        />
      ) : vista === "vencidos" ? (
        <AbiertosView cobros={cobrosVencidos} />
      ) : (
        <PendientesView
          horizonte={horizonte}
          onHorizonteChange={setHorizonte}
          cobros={pendientesEnHorizonte}
        />
      )}
    </div>
  );
}

function RecibidosView({
  periodo,
  onPeriodoChange,
  cobros,
  etiquetaPeriodo,
}: {
  periodo: MaquetaPeriodo;
  onPeriodoChange: (next: MaquetaPeriodo) => void;
  cobros: typeof DEMO_CASH_FLOW_TRANSACTIONS;
  etiquetaPeriodo: string;
}) {
  const [mesSeleccionado, setMesSeleccionado] = React.useState("todos");
  const [orden, setOrden] = React.useState<{
    columna: "fecha" | "monto";
    direccion: "asc" | "desc";
  }>({ columna: "fecha", direccion: "desc" });
  const meses = React.useMemo(() => mesesDeCobros(cobros), [cobros]);
  const cobrosDelMes =
    mesSeleccionado === "todos"
      ? cobros
      : cobros.filter((movement) => movement.date.startsWith(mesSeleccionado));
  const cobrosOrdenados = [...cobrosDelMes].sort((a, b) => {
    const diferencia =
      orden.columna === "fecha"
        ? a.date.localeCompare(b.date)
        : Number(a.inflow) - Number(b.inflow);
    return orden.direccion === "asc" ? diferencia : -diferencia;
  });
  const total = cobrosDelMes.reduce((sum, movement) => sum + Number(movement.inflow), 0);
  const mayorCobro = cobrosDelMes.reduce(
    (max, movement) => Math.max(max, Number(movement.inflow)),
    0,
  );
  const cambiarPeriodo = (next: MaquetaPeriodo) => {
    setMesSeleccionado("todos");
    onPeriodoChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-neutral-dark">Período de consulta</p>
        <MaquetaPeriodoSelector value={periodo} onChange={cambiarPeriodo} />
      </div>

      <section
        aria-label="Resumen de cobros recibidos"
        className="grid gap-3 sm:grid-cols-[1.25fr_1fr_1fr]"
      >
        <SummaryCard
          label="Total recibido"
          value={formatClp(total)}
          detail={etiquetaPeriodo}
          icon={ArrowDownLeft}
          tone="green"
          featured
        />
        <SummaryCard
          label="Cobros recibidos"
          value={String(cobrosDelMes.length)}
          detail={
            cobrosDelMes.length === 1 ? "Movimiento en el período" : "Movimientos en el período"
          }
          icon={ReceiptText}
          tone="blue"
        />
        <SummaryCard
          label="Cobro de mayor monto"
          value={formatClp(mayorCobro)}
          detail={
            cobrosDelMes.length ? "En el período seleccionado" : "Amplía el período para ver cobros"
          }
          icon={FileText}
          tone="neutral"
        />
      </section>

      <section className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-border bg-surface-muted/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <h2 className="font-semibold text-neutral-dark">Historial de cobros</h2>
          </div>
          {periodo.dias === 90 && (
            <label className="flex items-center gap-2 text-sm text-neutral-mid">
              <span>Mes</span>
              <select
                aria-label="Filtrar cobros por mes"
                value={mesSeleccionado}
                onChange={(event) => setMesSeleccionado(event.target.value)}
                className="h-9 max-w-[200px] rounded-lg border border-border bg-surface px-3 text-sm text-neutral-dark"
              >
                <option value="todos">Todos los meses</option>
                {meses.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {cobrosDelMes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-mid">
            Amplía el período para ver cobros recibidos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/40 text-xs font-semibold uppercase tracking-wide text-neutral-mid">
                <tr>
                  <th
                    aria-sort={
                      orden.columna === "fecha"
                        ? orden.direccion === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="w-[230px] px-5 py-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Fecha</span>
                      <details className="group relative font-normal normal-case tracking-normal">
                        <summary
                          aria-label="Ordenar por fecha"
                          title="Ordenar por fecha"
                          className="flex size-6 cursor-pointer list-none items-center justify-center rounded hover:bg-neutral-100 [&::-webkit-details-marker]:hidden"
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </summary>
                        <div className="absolute top-full left-0 z-30 mt-1 min-w-52 rounded-lg border border-border bg-surface p-1.5 text-sm shadow-lg">
                          {[
                            { value: "desc", label: "Más reciente a más antiguo" },
                            { value: "asc", label: "Más antiguo a más reciente" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={
                                orden.columna === "fecha" && orden.direccion === option.value
                              }
                              onClick={(event) => {
                                setOrden({
                                  columna: "fecha",
                                  direccion: option.value as "asc" | "desc",
                                });
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                              className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </th>
                  <th className="w-[260px] px-5 py-3">Cobro</th>
                  <th className="w-[190px] px-5 py-3">Cliente</th>
                  <th className="w-[150px] px-5 py-3">RUT</th>
                  <th className="w-[180px] px-5 py-3">Documento</th>
                  <th
                    aria-sort={
                      orden.columna === "monto"
                        ? orden.direccion === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="w-[230px] px-5 py-3 text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Monto</span>
                      <details className="group relative font-normal normal-case tracking-normal">
                        <summary
                          aria-label="Ordenar por monto"
                          title="Ordenar por monto"
                          className="flex size-6 cursor-pointer list-none items-center justify-center rounded hover:bg-neutral-100 [&::-webkit-details-marker]:hidden"
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </summary>
                        <div className="absolute top-full right-0 z-30 mt-1 min-w-40 rounded-lg border border-border bg-surface p-1.5 text-sm shadow-lg">
                          {[
                            { value: "desc", label: "Mayor a menor" },
                            { value: "asc", label: "Menor a mayor" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={
                                orden.columna === "monto" && orden.direccion === option.value
                              }
                              onClick={(event) => {
                                setOrden({
                                  columna: "monto",
                                  direccion: option.value as "asc" | "desc",
                                });
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                              className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {cobrosOrdenados.map((movement) => {
                  const detalle = DETALLES_COBROS_REALIZADOS[movement.id];
                  return (
                    <tr key={movement.id} className="transition-colors hover:bg-surface-muted/30">
                      <td className="whitespace-nowrap px-5 py-4 font-medium tabular-nums text-neutral-mid">
                        <time dateTime={movement.date}>{formatDateLike(movement.date)}</time>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-neutral-dark">
                          {nombreMovimientoCobro(movement.description)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-neutral-dark">
                        {detalle?.cliente ?? "Consumidor final"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 tabular-nums text-neutral-mid">
                        {detalle?.rut ?? "Consumidor final"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-neutral-dark">
                        {detalle?.documento ?? "Boleta electrónica"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-emerald-700">
                        {formatClp(Number(movement.inflow))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PendientesView({
  horizonte,
  onHorizonteChange,
  cobros,
}: {
  horizonte: Horizonte;
  onHorizonteChange: (next: Horizonte) => void;
  cobros: CobroAbierto[];
}) {
  const [filtroFecha, setFiltroFecha] = React.useState<"todas" | "sin_fecha">("todas");
  const cobrosFiltrados = cobros.filter((movement) => {
    return filtroFecha === "sin_fecha" ? movement.date === null : true;
  });
  const total = cobrosFiltrados.reduce((sum, movement) => sum + movement.amount, 0);
  const conFecha = cobrosFiltrados.filter((movement) => movement.date !== null);
  const sinFecha = cobrosFiltrados.filter((movement) => movement.date === null);
  const proximoCobro = [...conFecha].sort((a, b) => a.date!.localeCompare(b.date!))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-neutral-dark">Ver cobros hasta</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Horizonte de cobros futuros">
          {HORIZONTES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={horizonte === days}
              onClick={() => onHorizonteChange(days)}
              className={
                horizonte === days
                  ? "rounded-lg border border-brand-primary bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-surface-muted"
              }
            >
              {days} días
            </button>
          ))}
        </div>
      </div>

      <section
        aria-label="Resumen de cobros pendientes"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          label={`Por recibir · ${horizonte} días`}
          value={formatClp(total)}
          icon={Clock3}
          tone="green"
          featured
        />
        <SummaryCard
          label="Con fecha"
          value={String(conFecha.length)}
          icon={CalendarClock}
          tone="blue"
        />
        <SummaryCard
          label="Sin fecha confirmada"
          value={String(sinFecha.length)}
          icon={FileText}
          tone="neutral"
        />
        <SummaryCard
          label="Próximo cobro"
          value={proximoCobro?.date ? formatDateLike(proximoCobro.date) : "Estira el horizonte"}
          icon={FileText}
          tone="neutral"
        />
      </section>

      <section className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-border bg-surface-muted/40 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <h2 className="font-semibold text-neutral-dark">Cobros pendientes</h2>
            </div>
          </div>
        </div>
        {cobrosFiltrados.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-mid">
            Estira el horizonte a 30 o 90 días para ver más cobros.
          </p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] gap-4 border-b border-border bg-surface-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-mid lg:grid">
              <label className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                <span>Fecha</span>
                <details className="group relative normal-case tracking-normal">
                  <summary
                    aria-label="Filtrar por fecha"
                    title="Filtrar por fecha"
                    className={`flex size-6 cursor-pointer list-none items-center justify-center rounded hover:bg-neutral-100 [&::-webkit-details-marker]:hidden ${filtroFecha === "sin_fecha" ? "text-brand-primary" : "text-neutral-mid"}`}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </summary>
                  <div className="absolute top-full left-0 z-30 mt-1 min-w-40 rounded-lg border border-border bg-surface p-1.5 text-sm font-normal normal-case tracking-normal shadow-lg">
                    <button
                      type="button"
                      aria-pressed={filtroFecha === "todas"}
                      onClick={(event) => {
                        setFiltroFecha("todas");
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                      className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      aria-pressed={filtroFecha === "sin_fecha"}
                      onClick={(event) => {
                        setFiltroFecha("sin_fecha");
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                      className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                    >
                      Sin fecha
                    </button>
                  </div>
                </details>
              </label>
              <span>Cobro</span>
              <span>Cliente</span>
              <span>RUT</span>
              <span>Documento</span>
              <span className="text-right">Monto</span>
            </div>
            <PendingGroup
              items={cobrosFiltrados}
              emptyLabel="Estira el horizonte para ver cobros de este período."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function PendingGroup({ items, emptyLabel }: { items: CobroAbierto[]; emptyLabel: string }) {
  return (
    <section aria-label="Movimientos pendientes">
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-neutral-mid">{emptyLabel}</p>
      ) : (
        <ol className="divide-y divide-border/70">
          {items.map((movement) => (
            <li
              key={movement.id}
              className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] lg:items-center lg:gap-4"
            >
              <time
                dateTime={movement.date ?? undefined}
                className="col-start-1 row-start-1 text-sm font-medium tabular-nums text-neutral-mid lg:col-auto lg:row-auto"
              >
                {movement.date ? formatDateLike(movement.date) : "Fecha por confirmar"}
              </time>
              <div className="col-span-2 min-w-0 lg:col-auto lg:row-auto">
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                  Cobro
                </span>
                <p className="font-medium text-neutral-dark">{nombreCobro(movement.label)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {movement.date === localDateKey(new Date()) && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                      Vence hoy
                    </span>
                  )}
                </div>
              </div>
              <p className="col-span-2 min-w-0 text-sm text-neutral-dark lg:col-auto lg:row-auto">
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                  Cliente
                </span>
                {movement.customerName}
              </p>
              <p className="text-sm tabular-nums text-neutral-mid lg:col-auto lg:row-auto">
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                  RUT
                </span>
                {movement.customerRut ?? "Consumidor final"}
              </p>
              <p className="text-sm text-neutral-dark lg:col-auto lg:row-auto">
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                  Documento
                </span>
                {movement.documentReference ?? "Boleta electrónica"}
              </p>
              <p className="col-start-2 row-start-1 justify-self-end text-right font-semibold tabular-nums text-emerald-700 lg:col-auto lg:row-auto">
                {formatClp(movement.amount)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AbiertosView({ cobros }: { cobros: CobroAbierto[] }) {
  const [orden, setOrden] = React.useState<{
    columna: "fecha" | "monto";
    direccion: "asc" | "desc";
  }>({ columna: "fecha", direccion: "asc" });
  const total = cobros.reduce((sum, movement) => sum + movement.amount, 0);
  const cobrosOrdenados = [...cobros].sort((a, b) => {
    const diferencia =
      orden.columna === "fecha" ? (a.date ?? "").localeCompare(b.date ?? "") : a.amount - b.amount;
    return orden.direccion === "asc" ? diferencia : -diferencia;
  });
  return (
    <div className="space-y-4">
      <section aria-label="Resumen de cobros vencidos" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total vencido"
          value={formatClp(total)}
          icon={Clock3}
          tone="red"
          featured
        />
        <SummaryCard
          label="Cobros vencidos"
          value={String(cobros.length)}
          icon={CalendarClock}
          tone="blue"
        />
        <SummaryCard
          label="Más antiguo"
          value={cobros[0]?.date ? formatDateLike(cobros[0].date) : "Al día"}
          icon={FileText}
          tone="neutral"
        />
      </section>
      <section className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-border bg-surface-muted/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <h2 className="font-semibold text-neutral-dark">Cobros vencidos</h2>
          </div>
        </div>
        {cobros.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-mid">
            Al día: todo lo emitido está dentro de plazo.
          </p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] gap-4 border-b border-border bg-surface-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-mid lg:grid">
              <div className="flex min-w-0 items-center gap-1.5">
                <span>Fecha</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar por fecha"
                    title="Ordenar por fecha"
                    className="flex size-6 cursor-pointer list-none items-center justify-center rounded hover:bg-neutral-100 [&::-webkit-details-marker]:hidden"
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </summary>
                  <div className="absolute top-full left-0 z-30 mt-1 min-w-52 rounded-lg border border-border bg-surface p-1.5 text-sm shadow-lg">
                    {[
                      { value: "desc", label: "Más reciente a más antiguo" },
                      { value: "asc", label: "Más antiguo a más reciente" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={orden.columna === "fecha" && orden.direccion === option.value}
                        onClick={(event) => {
                          setOrden({ columna: "fecha", direccion: option.value as "asc" | "desc" });
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                        className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <span>Cobro</span>
              <span>Cliente</span>
              <span>RUT</span>
              <span>Documento</span>
              <div className="flex items-center justify-end gap-1.5">
                <span>Monto</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar por monto"
                    title="Ordenar por monto"
                    className="flex size-6 cursor-pointer list-none items-center justify-center rounded hover:bg-neutral-100 [&::-webkit-details-marker]:hidden"
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </summary>
                  <div className="absolute top-full right-0 z-30 mt-1 min-w-40 rounded-lg border border-border bg-surface p-1.5 text-sm shadow-lg">
                    {[
                      { value: "desc", label: "Mayor a menor" },
                      { value: "asc", label: "Menor a mayor" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={orden.columna === "monto" && orden.direccion === option.value}
                        onClick={(event) => {
                          setOrden({ columna: "monto", direccion: option.value as "asc" | "desc" });
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                        className="block w-full rounded px-2.5 py-2 text-left text-neutral-dark hover:bg-surface-muted"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>
            <ol className="divide-y divide-border/70">
              {cobrosOrdenados.map((movement) => (
                <li
                  key={movement.id}
                  className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] lg:items-center lg:gap-4"
                >
                  <time
                    className="col-start-1 row-start-1 text-sm font-medium tabular-nums text-neutral-mid lg:col-auto lg:row-auto"
                    dateTime={movement.date ?? undefined}
                  >
                    {movement.date ? formatDateLike(movement.date) : "Sin vencimiento"}
                  </time>
                  <div className="col-span-2 min-w-0 lg:col-auto lg:row-auto">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                      Cobro
                    </span>
                    <p className="font-medium text-neutral-dark">{nombreCobro(movement.label)}</p>
                  </div>
                  <p className="col-span-2 min-w-0 text-sm text-neutral-dark lg:col-auto lg:row-auto">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                      Cliente
                    </span>
                    {movement.customerName}
                  </p>
                  <p className="text-sm tabular-nums text-neutral-mid lg:col-auto lg:row-auto">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                      RUT
                    </span>
                    {movement.customerRut ?? "Consumidor final"}
                  </p>
                  <p className="text-sm text-neutral-dark lg:col-auto lg:row-auto">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                      Documento
                    </span>
                    {movement.documentReference ?? "Boleta electrónica"}
                  </p>
                  <p className="col-start-2 row-start-1 justify-self-end text-right font-semibold tabular-nums text-red-600 lg:col-auto lg:row-auto">
                    {formatClp(movement.amount)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded-lg border border-brand-primary/20 bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          : "rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-neutral-mid transition-colors hover:border-brand-primary/30 hover:text-neutral-dark"
      }
    >
      {children}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  featured = false,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof ArrowDownLeft;
  tone: "green" | "blue" | "neutral" | "red";
  featured?: boolean;
}) {
  const color = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-brand-primary",
    neutral: "bg-surface-muted text-neutral-mid",
    red: "bg-red-50 text-red-600",
  }[tone];
  const valueColor =
    tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "text-neutral-dark";
  return (
    <article
      className={
        featured
          ? "relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-surface to-surface p-4 shadow-sm sm:p-5"
          : "rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-mid">{label}</p>
        <span className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p
        className={`${featured ? "mt-3 text-3xl" : "mt-3 text-2xl"} font-bold tabular-nums tracking-tight ${valueColor}`}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-neutral-mid">{detail}</p>}
    </article>
  );
}

function mesesDeCobros(cobros: typeof DEMO_CASH_FLOW_TRANSACTIONS) {
  return [...new Set(cobros.map((movement) => movement.date.slice(0, 7)))]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const largo = periodoLargo(key) ?? key;
      return { key, label: largo.charAt(0).toLocaleUpperCase("es-CL") + largo.slice(1) };
    });
}

function defaultPeriod(today: Date): MaquetaPeriodo {
  return periodoDeVentana(90, today);
}

function nombreCobro(label: string): string {
  return label
    .replace(/^(?:Cobro (?:esperado|programado|vencido)|Factura vencida)\s*·\s*/i, "")
    .trim();
}

function nombreMovimientoCobro(description: string): string {
  return description.replace(/^Cobro de (?:factura|venta)\s*·\s*/i, "").trim();
}

function dateRange(period: MaquetaPeriodo, today: Date): { desde: string; hasta: string } {
  if (period.dias) {
    const start = new Date(today);
    start.setDate(start.getDate() - (period.dias - 1));
    return { desde: localDateKey(start), hasta: localDateKey(today) };
  }
  const [year = today.getFullYear(), month = today.getMonth() + 1] = period.period_to
    .split("-")
    .map(Number);
  return {
    desde: `${period.period_from}-01`,
    hasta: `${period.period_to}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
  };
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function offsetDate(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}
