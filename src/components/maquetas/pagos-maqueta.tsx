"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  Clock3,
  FileText,
  ReceiptText,
} from "lucide-react";
import { MaquetaPeriodoSelector, periodoDeVentana, type MaquetaPeriodo } from "./maqueta-periodo";
import { buildDemoCashProjection } from "@/lib/demo/projection-data";
import {
  DEMO_CASH_FLOW_TRANSACTIONS,
  DEMO_CURRENT_BALANCE,
  DEMO_SUPPLIER_PURCHASE,
} from "@/lib/demo/cash-flow-data";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { periodoLargo } from "@/lib/formatters/months";

type VistaPagos = "realizados" | "pendientes";
type Horizonte = 7 | 14 | 30 | 90;

const HORIZONTES: Horizonte[] = [7, 14, 30, 90];

const DETALLES_PAGOS_PENDIENTES: Record<
  string,
  { proveedor: string; rut: string; documento: string }
> = {
  "Pago pendiente · servicio de internet": {
    proveedor: "Mundo Telecom",
    rut: "76.111.111-6",
    documento: "Factura electrónica N.º 30001",
  },
  "Pago pendiente · cuenta de electricidad": {
    proveedor: "CGE",
    rut: "76.543.210-3",
    documento: "Factura electrónica N.º 30002",
  },
  "Reposición de inventario · proveedores": {
    proveedor: DEMO_SUPPLIER_PURCHASE.supplierName,
    rut: DEMO_SUPPLIER_PURCHASE.supplierRut,
    documento: "Factura electrónica N.º 9002",
  },
  "Remuneraciones del período": {
    proveedor: "Equipo operativo",
    rut: "60.805.000-0",
    documento: "Nómina de remuneraciones · liquidaciones",
  },
  "Arriendo y servicios": {
    proveedor: "Inmobiliaria Centro Ltda.",
    rut: "76.876.543-K",
    documento: "Factura electrónica N.º 30003",
  },
  "Cotizaciones previsionales · Previred": {
    proveedor: "Previred",
    rut: "96.966.510-K",
    documento: "Planilla de cotizaciones · Previred",
  },
  "IVA del F29": {
    proveedor: "Tesorería General de la República",
    rut: "60.805.000-0",
    documento: "F29 · pago del período",
  },
  "Compra proyectada de insumos · proveedores": {
    proveedor: "Comercializadora Andina",
    rut: "77.456.789-5",
    documento: "Factura electrónica N.º 30004",
  },
  "Servicios y licencias": {
    proveedor: "Servicios y Licencias SpA",
    rut: "77.345.678-K",
    documento: "Factura electrónica N.º 30005",
  },
};

const DETALLES_PAGOS_REALIZADOS: Record<
  string,
  { proveedor: string; rut: string; documento: string }
> = {
  [`supplier-payment-33-${DEMO_SUPPLIER_PURCHASE.folio}`]: {
    proveedor: DEMO_SUPPLIER_PURCHASE.supplierName,
    rut: DEMO_SUPPLIER_PURCHASE.supplierRut,
    documento: `Factura electrónica N.º ${DEMO_SUPPLIER_PURCHASE.folio}`,
  },
  "used-equipment-july": {
    proveedor: "TecnoSur",
    rut: "76.234.567-8",
    documento: "Factura electrónica N.º 2104",
  },
  "working-capital-credit-payment-august": {
    proveedor: "Banco Santander",
    rut: "60.805.000-0",
    documento: "Comprobante de abono a crédito",
  },
  "demo-paid-rent-2026-09-24": {
    proveedor: "Inmobiliaria Centro Ltda.",
    rut: "76.876.543-K",
    documento: "Factura electrónica N.º 30003",
  },
  "demo-paid-electricity-2026-09-21": {
    proveedor: "CGE",
    rut: "76.543.210-3",
    documento: "Factura electrónica N.º 30002",
  },
  "demo-paid-materials-2026-09-19": {
    proveedor: "Comercializadora Andina",
    rut: "77.456.789-5",
    documento: "Factura electrónica N.º 30004",
  },
  "demo-paid-internet-2026-09-15": {
    proveedor: "Mundo Telecom",
    rut: "76.111.111-6",
    documento: "Factura electrónica N.º 30001",
  },
  "demo-paid-payroll-2026-09-12": {
    proveedor: "Equipo operativo",
    rut: "60.805.000-0",
    documento: "Nómina de remuneraciones · liquidaciones",
  },
  "demo-paid-accounting-2026-09-05": {
    proveedor: "Estudio Rivera",
    rut: "77.321.654-2",
    documento: "Boleta de honorarios electrónica N.º 452",
  },
  "demo-paid-previred-2026-08-21": {
    proveedor: "Previred",
    rut: "96.966.510-K",
    documento: "Planilla/comprobante de cotizaciones · Previred",
  },
  "demo-paid-software-2026-08-04": {
    proveedor: "Microsoft 365",
    rut: "55.000.123-4",
    documento: "Comprobante de suscripción N.º 30005",
  },
  "demo-paid-maintenance-2026-07-19": {
    proveedor: "TecnoSur",
    rut: "76.234.567-8",
    documento: "Factura electrónica N.º 2105",
  },
  "demo-paid-cleaning-2026-07-01": {
    proveedor: "LimpioSur",
    rut: "77.654.321-0",
    documento: "Factura electrónica N.º 30006",
  },
};

export function PagosMaqueta() {
  const [today] = React.useState(() => new Date());
  const [vista, setVista] = React.useState<VistaPagos>("pendientes");
  const [periodo, setPeriodo] = React.useState<MaquetaPeriodo>(() => defaultPeriod(today));
  const [horizonte, setHorizonte] = React.useState<Horizonte>(7);
  const movimientosDemo = DEMO_CASH_FLOW_TRANSACTIONS;

  React.useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("vista");
    if (requestedView === "pendientes" || requestedView === "realizados") {
      setVista(requestedView);
    }
  }, []);

  function cambiarVista(next: VistaPagos) {
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
  const pagosRealizados = movimientosDemo
    .filter(
      (movement) =>
        Number(movement.outflow) > 0 && movement.date >= desde && movement.date <= hasta,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const proyeccion = buildDemoCashProjection(horizonte, Number(DEMO_CURRENT_BALANCE), today, false);
  const pagosPendientes = (proyeccion.demo_movements ?? []).filter(
    (movement) => movement.amount < 0,
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Pagos</h1>
        </div>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-neutral-dark hover:border-brand-primary/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al inicio
        </Link>
      </header>

      <div aria-label="Tipo de pagos" className="flex gap-2" role="group">
        <TabButton active={vista === "pendientes"} onClick={() => cambiarVista("pendientes")}>
          Pendientes
        </TabButton>
        <TabButton active={vista === "realizados"} onClick={() => cambiarVista("realizados")}>
          Realizados
        </TabButton>
      </div>

      {vista === "realizados" ? (
        <RealizadosView periodo={periodo} onPeriodoChange={setPeriodo} pagos={pagosRealizados} />
      ) : (
        <PendientesView
          horizonte={horizonte}
          onHorizonteChange={setHorizonte}
          pagos={pagosPendientes}
        />
      )}
    </div>
  );
}

function RealizadosView({
  periodo,
  onPeriodoChange,
  pagos,
}: {
  periodo: MaquetaPeriodo;
  onPeriodoChange: (next: MaquetaPeriodo) => void;
  pagos: typeof DEMO_CASH_FLOW_TRANSACTIONS;
}) {
  const [mesSeleccionado, setMesSeleccionado] = React.useState("todos");
  const [orden, setOrden] = React.useState<{
    columna: "fecha" | "monto";
    direccion: "asc" | "desc";
  }>({ columna: "fecha", direccion: "desc" });
  const meses = React.useMemo(() => mesesDePagos(pagos), [pagos]);
  const pagosFiltrados =
    mesSeleccionado === "todos"
      ? pagos
      : pagos.filter((movement) => movement.date.startsWith(mesSeleccionado));
  const pagosOrdenados = [...pagosFiltrados].sort((a, b) => {
    const diferencia =
      orden.columna === "fecha"
        ? a.date.localeCompare(b.date)
        : Number(a.outflow) - Number(b.outflow);
    return orden.direccion === "asc" ? diferencia : -diferencia;
  });
  const total = pagosFiltrados.reduce((sum, movement) => sum + Number(movement.outflow), 0);
  const mayorPago = pagosFiltrados.reduce(
    (max, movement) => Math.max(max, Number(movement.outflow)),
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
        aria-label="Resumen de pagos realizados"
        className="grid gap-3 sm:grid-cols-[1.25fr_1fr_1fr]"
      >
        <SummaryCard
          label="Total pagado"
          value={formatClp(total)}
          icon={ArrowDownLeft}
          tone="red"
          featured
        />
        <SummaryCard
          label="Pagos realizados"
          value={String(pagosFiltrados.length)}
          icon={ReceiptText}
          tone="blue"
        />
        <SummaryCard
          label="Pago de mayor monto"
          value={formatClp(mayorPago)}
          icon={FileText}
          tone="neutral"
        />
      </section>

      <section className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-border bg-surface-muted/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <h2 className="font-semibold text-neutral-dark">Historial de pagos</h2>
          </div>
          {periodo.dias === 90 && (
            <label className="flex items-center gap-2 text-sm text-neutral-mid">
              <span>Mes</span>
              <select
                aria-label="Filtrar pagos por mes"
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
        {pagosFiltrados.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-mid">
            Amplía el período para ver pagos realizados.
          </p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] gap-4 border-b border-border bg-surface-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-mid lg:grid">
              <div className="flex min-w-0 items-center gap-1.5">
                <span>Fecha</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar pagos por fecha"
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
              <span>Pago</span>
              <span>Proveedor</span>
              <span>RUT</span>
              <span>Documento</span>
              <div className="flex items-center justify-end gap-1.5">
                <span>Monto</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar pagos por monto"
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
              {pagosOrdenados.map((movement) => {
                const detalle = DETALLES_PAGOS_REALIZADOS[movement.id];
                return (
                  <li
                    key={movement.id}
                    className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] lg:items-center lg:gap-4"
                  >
                    <time
                      dateTime={movement.date}
                      className="col-start-1 row-start-1 text-sm font-medium tabular-nums text-neutral-mid lg:col-auto lg:row-auto"
                    >
                      {formatDateLike(movement.date)}
                    </time>
                    <div className="col-span-2 min-w-0 lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Pago
                      </span>
                      <p className="font-medium text-neutral-dark">
                        {nombrePago(movement.description)}
                      </p>
                    </div>
                    <p className="col-span-2 min-w-0 text-sm text-neutral-dark lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Proveedor
                      </span>
                      {detalle?.proveedor ?? "Consumidor final"}
                    </p>
                    <p className="text-sm tabular-nums text-neutral-mid lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        RUT
                      </span>
                      {detalle?.rut ?? "Consumidor final"}
                    </p>
                    <p className="text-sm text-neutral-dark lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Documento
                      </span>
                      {detalle?.documento ?? "Boleta electrónica"}
                    </p>
                    <p className="col-start-2 row-start-1 justify-self-end text-right font-semibold tabular-nums text-red-600 lg:col-auto lg:row-auto">
                      {formatClp(Number(movement.outflow))}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function PendientesView({
  horizonte,
  onHorizonteChange,
  pagos,
}: {
  horizonte: Horizonte;
  onHorizonteChange: (next: Horizonte) => void;
  pagos: ReturnType<typeof buildDemoCashProjection>["demo_movements"];
}) {
  const pendientes = (pagos ?? []).filter((movement) => movement.amount < 0);
  const [orden, setOrden] = React.useState<{
    columna: "fecha" | "monto";
    direccion: "asc" | "desc";
  }>({ columna: "fecha", direccion: "asc" });
  const pagosOrdenados = [...pendientes].sort((a, b) => {
    const diferencia =
      orden.columna === "fecha"
        ? a.date.localeCompare(b.date)
        : Math.abs(a.amount) - Math.abs(b.amount);
    return orden.direccion === "asc" ? diferencia : -diferencia;
  });
  const total = pendientes.reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
  const proximoPago = pendientes[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-neutral-dark">Ver compromisos hasta</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Horizonte de pagos futuros">
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
        aria-label="Resumen de pagos pendientes"
        className="grid gap-3 sm:grid-cols-[1.25fr_1fr_1fr]"
      >
        <SummaryCard
          label={"Por pagar · " + horizonte + " días"}
          value={formatClp(total)}
          icon={Clock3}
          tone="red"
          featured
        />
        <SummaryCard
          label="Pagos pendientes"
          value={String(pendientes.length)}
          icon={CalendarClock}
          tone="blue"
        />
        <SummaryCard
          label="Próximo vencimiento"
          value={proximoPago ? formatDateLike(proximoPago.date) : "Estira el horizonte"}
          icon={FileText}
          tone="neutral"
        />
      </section>

      <section className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-col gap-4 rounded-t-xl border-b border-border bg-surface-muted/40 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <h2 className="font-semibold text-neutral-dark">Pagos pendientes</h2>
            </div>
          </div>
        </div>
        {pendientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-mid">
            Estira el horizonte a 30 o 90 días para ver más compromisos.
          </p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] gap-4 border-b border-border bg-surface-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-mid lg:grid">
              <div className="flex min-w-0 items-center gap-1.5">
                <span>Fecha</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar pagos por fecha"
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
              <span>Pago</span>
              <span>Proveedor</span>
              <span>RUT</span>
              <span>Documento</span>
              <div className="flex items-center justify-end gap-1.5">
                <span>Monto</span>
                <details className="group relative font-normal normal-case tracking-normal">
                  <summary
                    aria-label="Ordenar pagos por monto"
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
            <ol className="divide-y divide-border">
              {pagosOrdenados.map((movement) => {
                const venceHoy = movement.date === localDateKey(new Date());
                const detalle = DETALLES_PAGOS_PENDIENTES[movement.label];
                return (
                  <li
                    key={movement.date + movement.label}
                    className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(105px,0.65fr)_minmax(175px,1.15fr)_minmax(145px,1fr)_minmax(120px,0.85fr)_minmax(115px,0.8fr)_auto] lg:items-center lg:gap-4"
                  >
                    <time
                      dateTime={movement.date}
                      className="col-start-1 row-start-1 text-sm font-medium tabular-nums text-neutral-mid lg:col-auto lg:row-auto"
                    >
                      {formatDateLike(movement.date)}
                    </time>
                    <div className="col-span-2 min-w-0 lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Pago
                      </span>
                      <p className="font-medium text-neutral-dark">{nombrePago(movement.label)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {venceHoy && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            Vence hoy
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="col-span-2 min-w-0 text-sm text-neutral-dark lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Proveedor
                      </span>
                      {detalle?.proveedor ?? "Consumidor final"}
                    </p>
                    <p className="text-sm tabular-nums text-neutral-mid lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        RUT
                      </span>
                      {detalle?.rut ?? "Consumidor final"}
                    </p>
                    <p className="text-sm text-neutral-dark lg:col-auto lg:row-auto">
                      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-mid lg:hidden">
                        Documento
                      </span>
                      {detalle?.documento ?? "Boleta electrónica"}
                    </p>
                    <p className="col-start-2 row-start-1 justify-self-end text-right font-semibold tabular-nums text-red-600 lg:col-auto lg:row-auto">
                      {formatClp(Math.abs(movement.amount))}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <RelatedLink href="/caja/proyeccion" label="Ver en proyección de caja" />
        <RelatedLink href="/flujo-de-caja" label="Ver flujo de caja" />
      </div>
      <p className="text-xs text-neutral-mid">
        Son compromisos futuros simulados; todavía no son pagos ejecutados. Se consideran también en
        la proyección de caja.
      </p>
    </div>
  );
}

function defaultPeriod(today: Date): MaquetaPeriodo {
  return periodoDeVentana(90, today);
}

function nombrePago(label: string): string {
  const nombre = label.replace(/^Pago pendiente\s*·\s*/i, "").split("·")[0];
  return nombre?.trim() ?? label.trim();
}

function dateRange(period: MaquetaPeriodo, today: Date): { desde: string; hasta: string } {
  if (period.dias) {
    if (period.dias === 90) {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return { desde: localDateKey(firstDay), hasta: localDateKey(today) };
    }
    const start = new Date(today);
    start.setDate(start.getDate() - (period.dias - 1));
    return { desde: localDateKey(start), hasta: localDateKey(today) };
  }
  const [year = today.getFullYear(), month = today.getMonth() + 1] = period.period_to
    .split("-")
    .map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    desde: period.period_from + "-01",
    hasta: period.period_to + "-" + String(lastDay).padStart(2, "0"),
  };
}

function localDateKey(date: Date): string {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
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
  tone: "red" | "blue" | "neutral";
  featured?: boolean;
}) {
  const color = {
    red: "text-red-600 bg-red-50",
    blue: "text-brand-primary bg-blue-50",
    neutral: "text-neutral-mid bg-surface-muted",
  }[tone];
  return (
    <article
      className={
        featured
          ? "relative overflow-hidden rounded-xl border border-red-100 bg-gradient-to-br from-red-50/80 via-surface to-surface p-4 shadow-sm sm:p-5"
          : "rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-mid">{label}</p>
        <span className={"rounded-lg p-2 " + color}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p
        className={
          featured
            ? "mt-3 text-3xl font-bold tabular-nums tracking-tight text-red-600"
            : tone === "red"
              ? "mt-3 text-2xl font-bold tabular-nums text-red-600"
              : "mt-3 text-2xl font-bold tabular-nums text-neutral-dark"
        }
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-neutral-mid">{detail}</p>}
    </article>
  );
}

function mesesDePagos(pagos: typeof DEMO_CASH_FLOW_TRANSACTIONS) {
  return [...new Set(pagos.map((movement) => movement.date.slice(0, 7)))]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const largo = periodoLargo(key) ?? key;
      return { key, label: largo.charAt(0).toLocaleUpperCase("es-CL") + largo.slice(1) };
    });
}

function RelatedLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
