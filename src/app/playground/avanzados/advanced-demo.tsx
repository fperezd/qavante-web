"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  QavanteBoard,
  type BoardState,
  QavanteDataTable,
  QavanteCollapsible,
  QavanteAreaChart,
  QavanteBarChart,
  QavanteLineChart,
  QavanteButton,
  QavanteCard,
  toast,
} from "@/components/qavante";

/* Demo DEV de los primitivos interactivos avanzados (Capa 1). No es producto:
   datos de muestra agnósticos para verlos funcionando. */

type Task = { id: string; title: string; owner: string };
type Row = { id: string; producto: string; region: string; unidades: number };
type Punto = { mes: string; ingresos: number; costos: number };

const INITIAL_BOARD: BoardState<Task> = [
  {
    id: "todo",
    title: "Por hacer",
    items: [
      { id: "t1", title: "Diseñar onboarding", owner: "Ana" },
      { id: "t2", title: "Revisar contratos", owner: "Luis" },
    ],
  },
  {
    id: "doing",
    title: "En curso",
    items: [{ id: "t3", title: "Integrar API de pagos", owner: "Sofía" }],
  },
  { id: "done", title: "Listo", items: [{ id: "t4", title: "Setup de CI", owner: "Marco" }] },
];

const ROWS: Row[] = [
  { id: "1", producto: "Plan Pro", region: "Norte", unidades: 1240 },
  { id: "2", producto: "Plan Lite", region: "Centro", unidades: 980 },
  { id: "3", producto: "Add-on", region: "Sur", unidades: 432 },
  { id: "4", producto: "Plan Pro", region: "Centro", unidades: 1875 },
  { id: "5", producto: "Plan Lite", region: "Norte", unidades: 640 },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  {
    id: "producto",
    accessorKey: "producto",
    header: "Producto",
    cell: (i) => i.getValue<string>(),
  },
  { id: "region", accessorKey: "region", header: "Región", cell: (i) => i.getValue<string>() },
  {
    id: "unidades",
    accessorKey: "unidades",
    header: "Unidades",
    cell: (i) => (
      <span className="tabular-nums">{i.getValue<number>().toLocaleString("es-CL")}</span>
    ),
  },
];

const CHART_DATA: Punto[] = [
  { mes: "Ene", ingresos: 120, costos: 80 },
  { mes: "Feb", ingresos: 145, costos: 90 },
  { mes: "Mar", ingresos: 132, costos: 88 },
  { mes: "Abr", ingresos: 168, costos: 102 },
  { mes: "May", ingresos: 190, costos: 110 },
  { mes: "Jun", ingresos: 175, costos: 105 },
];

const SERIES = [
  { key: "ingresos", label: "Ingresos" },
  { key: "costos", label: "Costos" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AdvancedDemo() {
  const [board, setBoard] = React.useState(INITIAL_BOARD);

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-brand-deep">
          Primitivos interactivos — Capa 1
        </h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Kanban (DnD), DataTable (orden + mostrar/ocultar + reordenar columnas), Collapsible y
          Charts. Datos de muestra.
        </p>
      </header>

      <Section title="Board / Kanban — arrastrá las tarjetas entre columnas">
        <QavanteBoard
          columns={board}
          onColumnsChange={setBoard}
          renderCard={(t) => (
            <div>
              <p className="text-sm font-medium text-neutral-dark">{t.title}</p>
              <p className="text-xs text-neutral-mid">{t.owner}</p>
            </div>
          )}
        />
      </Section>

      <Section title="DataTable — ordená, mostrá/ocultá y reordená columnas (drag)">
        <QavanteDataTable data={ROWS} columns={COLUMNS} />
      </Section>

      <Section title="Collapsible">
        <QavanteCollapsible title="¿Qué incluye este plan?" defaultOpen>
          Acceso completo, soporte prioritario y reportes avanzados. La sección se expande y colapsa
          con animación, accesible por teclado.
        </QavanteCollapsible>
      </Section>

      <Section title="Charts — tematizados con tokens de marca">
        <div className="grid gap-4 md:grid-cols-3">
          <QavanteCard header="Área">
            <QavanteAreaChart data={CHART_DATA} index="mes" series={SERIES} height={200} />
          </QavanteCard>
          <QavanteCard header="Barras">
            <QavanteBarChart data={CHART_DATA} index="mes" series={SERIES} height={200} />
          </QavanteCard>
          <QavanteCard header="Líneas">
            <QavanteLineChart data={CHART_DATA} index="mes" series={SERIES} height={200} />
          </QavanteCard>
        </div>
      </Section>

      <Section title="Toaster">
        <div className="flex gap-2">
          <QavanteButton size="sm" onClick={() => toast.success("Guardado correctamente.")}>
            Toast éxito
          </QavanteButton>
          <QavanteButton
            size="sm"
            variant="danger"
            onClick={() => toast.error("No pudimos completar la acción.")}
          >
            Toast error
          </QavanteButton>
        </div>
      </Section>
    </div>
  );
}
