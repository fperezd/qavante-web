import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ColumnDef } from "@tanstack/react-table";
import { QavanteDataTable } from "./qavante-data-table";

type Row = { id: string; producto: string; region: string; unidades: number };

const rows: Row[] = [
  { id: "1", producto: "Plan Pro", region: "Norte", unidades: 1240 },
  { id: "2", producto: "Plan Lite", region: "Centro", unidades: 980 },
  { id: "3", producto: "Add-on", region: "Sur", unidades: 432 },
  { id: "4", producto: "Plan Pro", region: "Centro", unidades: 1875 },
  { id: "5", producto: "Plan Lite", region: "Norte", unidades: 640 },
];

const columns: ColumnDef<Row, unknown>[] = [
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

const meta = {
  title: "Capa 1 / QavanteDataTable",
  component: QavanteDataTable<Row>,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tabla de datos sobre TanStack Table: ordenamiento por columna, mostrar/ocultar columnas y reordenarlas por drag & drop (dnd-kit). Header sticky, `tabular-nums`, hover de fila.",
      },
    },
  },
  args: { data: rows, columns },
} satisfies Meta<typeof QavanteDataTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completa: Story = {};

export const SinReorden: Story = {
  args: { enableReorder: false },
};

export const SinPanelColumnas: Story = {
  args: { enableColumnToggle: false },
};
