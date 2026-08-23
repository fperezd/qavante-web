import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ColumnDef } from "@tanstack/react-table";
import { within, userEvent, expect } from "storybook/test";
import { RedisenoTable, TablePrimaryCell } from "./table";
import { Pill } from "./pill";

interface Cliente {
  nombre: string;
  detalle: string;
  dias: number;
  saldo: number;
}

const clientes: Cliente[] = [
  { nombre: "Diveimport S.A.", detalle: "vencido hace 73 días", dias: 73, saldo: 11582539 },
  { nombre: "Comercial Kaufmann S.A.", detalle: "vencido hace 34 días", dias: 34, saldo: 4322373 },
  {
    nombre: "Empresa de Correos de Chile",
    detalle: "vencido hace 21 días",
    dias: 21,
    saldo: 4672594,
  },
  { nombre: "GPS7000", detalle: "vencido hace 80 días, sin gestión", dias: 80, saldo: 1792441 },
  { nombre: "Tepille SpA", detalle: "abonó $6,0M el 21 ago", dias: 0, saldo: 1050041 },
];

// 60 filas para forzar paginación (pageSize default 50) sin datos reales.
const muchosClientes: Cliente[] = Array.from({ length: 60 }, (_, i) => ({
  nombre: `Cliente ${i + 1}`,
  detalle: `vencido hace ${i} días`,
  dias: i,
  saldo: 100000 * (i + 1),
}));

const columns: ColumnDef<Cliente, unknown>[] = [
  {
    accessorKey: "nombre",
    header: "Cliente",
    meta: { principal: true },
    cell: ({ row }) => <TablePrimaryCell value={row.original.nombre} sub={row.original.detalle} />,
  },
  {
    accessorKey: "dias",
    header: "Antigüedad",
    meta: { hideBelow: "sm" },
    cell: ({ row }) => (
      <Pill variant={row.original.dias > 60 ? "bad" : row.original.dias > 0 ? "warn" : "ok"}>
        {row.original.dias > 0 ? `${row.original.dias} días` : "Pagando"}
      </Pill>
    ),
  },
  {
    accessorKey: "saldo",
    header: "Saldo",
    meta: { align: "right" },
    cell: ({ row }) => `$${row.original.saldo.toLocaleString("es-CL")}`,
  },
];

const meta = {
  title: "Rediseño / Table",
  component: RedisenoTable,
  parameters: { layout: "padded" },
  args: { columns, data: clientes },
} satisfies Meta<typeof RedisenoTable<Cliente>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onExport: () => {} },
};

export const Vacia: Story = {
  args: { data: [], emptyMessage: "Sin clientes con saldo pendiente." },
};

/** La columna principal nunca trunca (Ley 7): el nombre completo debe estar
 *  presente en el DOM, aunque sea el más largo de la tabla. */
export const ColumnaPrincipalCompleta: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Empresa de Correos de Chile")).toBeVisible();
    await expect(canvas.getByText("Comercial Kaufmann S.A.")).toBeVisible();
  },
};

/** Clic en el header de Saldo ordena (TanStack: numéricas empiezan desc), un
 *  segundo clic invierte a asc. */
export const OrdenaPorHeader: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /Saldo/ });

    function rowsInOrder() {
      const rows = canvas.getAllByRole("row").slice(1); // sin el header
      return rows.map((r) => r.textContent ?? "");
    }

    await userEvent.click(header);
    let rows = rowsInOrder();
    await expect(rows[0]).toContain("Diveimport"); // saldo más alto primero (desc)

    await userEvent.click(header);
    rows = rowsInOrder();
    await expect(rows[0]).toContain("Tepille"); // saldo más bajo primero (asc)
  },
};

/** Con más de una página, la paginación navega y respeta el límite de filas visibles. */
export const Paginacion: Story = {
  args: { data: muchosClientes, totalCount: 60 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cliente 1")).toBeVisible();
    await expect(canvas.queryByText("Cliente 51")).not.toBeInTheDocument();

    const next = canvas.getByRole("button", { name: "Página siguiente" });
    await userEvent.click(next);

    await expect(canvas.getByText("Cliente 51")).toBeVisible();
    await expect(canvas.queryByText("Cliente 1")).not.toBeInTheDocument();
  },
};
