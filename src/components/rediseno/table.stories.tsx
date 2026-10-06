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

/* Para `ColapsoViewportVsContenedor`: dos columnas de metadato, una con cada regla. */
const columnasColapso: ColumnDef<Cliente, unknown>[] = [
  {
    accessorKey: "nombre",
    header: "Cliente",
    meta: { principal: true },
    cell: ({ row }) => <TablePrimaryCell value={row.original.nombre} />,
  },
  { accessorKey: "dias", header: "PorViewport", meta: { hideBelow: "sm" } },
  { accessorKey: "saldo", header: "PorTabla", meta: { hideBelowTable: "sm" } },
];

/** Dos columnas visibles a 360 px: el subtítulo deliberadamente largo debe envolver y dejar
 * espacio al monto. Reproduce el riesgo compartido de V05 y V08 sin acoplar el primitivo a
 * ninguna de esas vistas. */
const columnasSubLargo: ColumnDef<Cliente, unknown>[] = [
  {
    accessorKey: "nombre",
    header: "Contraparte",
    meta: { principal: true },
    cell: ({ row }) => (
      <TablePrimaryCell
        value={row.original.nombre}
        sub="Vencido hace 73 días; última gestión sin respuesta y requiere revisión"
      />
    ),
  },
  {
    accessorKey: "saldo",
    header: "Monto",
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

/* Las DOS formas de colapsar una columna de metadato, medidas una contra la otra en el mismo
 * render: `hideBelow` mira el VIEWPORT y `hideBelowTable` mira el ancho de la TABLA.
 *
 * Existe porque la distinción no era gratis y estuvo a punto de irse sin que nada la mirara: al
 * construir la V04 de Cobrar (retirada el 2026-10-05, nunca llegó a montarse en una ruta) se
 * cambió `hideBelow` de viewport a contenedor creyendo que era el mismo comportamiento con otros
 * números. No lo es. Con el shell del repo (`p-6 md:p-8` + sidebar
 * `w-60`) el contenedor mide V−48 bajo `md` y V−304 de `md` para arriba, así que las columnas
 * 'Estado' de caja v02 y banco v03 y 'Tipo' de pagar v05 —que ya están en `main`— habrían
 * empezado a esconderse en viewport 640–687 y 768–943, donde hoy no se esconden nunca.
 *
 * La story corre al viewport ancho por defecto de Chromium con la tabla en un contenedor de 360
 * px: ahí las dos reglas dan resultados OPUESTOS, que es lo que la vuelve capaz de fallar. */
export const ColapsoViewportVsContenedor: Story = {
  name: "Colapso: hideBelow mira el viewport; hideBelowTable, la tabla",
  render: () => (
    <div data-angosta="true" style={{ width: 360 }}>
      <RedisenoTable columns={columnasColapso} data={clientes} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const caja = canvasElement.querySelector<HTMLElement>('[data-angosta="true"]')!;
    await expect(Math.round(caja.getBoundingClientRect().width)).toBe(360);
    /* Control: el viewport tiene que ser ancho, o las dos columnas colapsarían y la comparación
       no distinguiría nada. */
    await expect(document.documentElement.clientWidth).toBeGreaterThan(640);

    /* La del VIEWPORT sigue visible aunque la tabla mida 360 px… */
    await expect(canvas.getByRole("columnheader", { name: /PorViewport/ })).toBeVisible();
    /* …y la del CONTENEDOR no. */
    await expect(canvas.queryByRole("columnheader", { name: /PorTabla/ })).not.toBeInTheDocument();
  },
};

/** Ley 7: a 360 px el `sub` no fija un ancho mínimo ni se oculta con ellipsis. Se mide el
 * scroller efectivo, no el wrapper `overflow-hidden`, que reportaría cero aunque el dato quedara
 * recortado. */
export const SubLargo360: Story = {
  name: "Ley 7: subtítulo largo envuelve a 360 px",
  render: () => (
    <div data-angosta="sub-largo" style={{ width: 360, maxWidth: 360, overflow: "hidden" }}>
      <RedisenoTable columns={columnasSubLargo} data={clientes.slice(0, 1)} celdasCompactasEnAngosto />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const caja = canvasElement.querySelector<HTMLElement>('[data-angosta="sub-largo"]')!;
    await expect(Math.round(caja.getBoundingClientRect().width)).toBe(360);

    const tabla = caja.querySelector<HTMLElement>("table")!;
    const scroller = tabla.parentElement!;
    await expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);

    const sub = canvas.getByText(/Vencido hace 73 días/);
    await expect(getComputedStyle(sub).whiteSpace).toBe("normal");
    await expect(getComputedStyle(sub).textOverflow).not.toBe("ellipsis");
    await expect(sub.scrollHeight).toBeGreaterThan(12);
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
