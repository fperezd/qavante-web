import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ColumnDef } from "@tanstack/react-table";
import { QavanteBadge } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { DynamicTable } from "./dynamic-table";

/* PROPUESTA UX — Tabla dinámica (data-grid reutilizable).
   Ordenar (clic en el título), filtrar (botón «Filtros»), y reordenar columnas
   (arrastrar el título). Demostrado sobre el Libro de Ventas. Esta tabla puede
   reemplazar a todas las tablas de la app. */

interface Venta {
  tipo: string;
  folio: number;
  fecha: string; // ISO (ordenable); se muestra DD-MM-AAAA
  cliente: string;
  rut: string;
  neto: number;
  iva: number;
  total: number;
}

const data: Venta[] = [
  { tipo: "FAC-EL", folio: 423, fecha: "2026-06-24", cliente: "Aguas de Antofagasta S.A.", rut: "76418976-0", neto: 4610852, iva: 876062, total: 5486914 },
  { tipo: "FAC-EL", folio: 424, fecha: "2026-06-24", cliente: "Comercial Kaufmann S.A.", rut: "96572360-9", neto: 4847515, iva: 921028, total: 5768543 },
  { tipo: "FAC-EL", folio: 420, fecha: "2026-06-18", cliente: "Legalchile S.A.", rut: "96783190-5", neto: 1200000, iva: 228000, total: 1428000 },
  { tipo: "BOL-EL", folio: 425, fecha: "2026-06-27", cliente: "Consumidor final", rut: "66666666-6", neto: 420168, iva: 79832, total: 500000 },
  { tipo: "NC-EL", folio: 61, fecha: "2026-06-28", cliente: "Comercial Kaufmann S.A.", rut: "96572360-9", neto: 300000, iva: 57000, total: 357000 },
  { tipo: "FAC-EL", folio: 418, fecha: "2026-06-10", cliente: "Puerto Columbo S.A.", rut: "76008959-1", neto: 890000, iva: 169100, total: 1059100 },
  { tipo: "FAC-EL", folio: 421, fecha: "2026-06-20", cliente: "Maestra Servicios S.A.", rut: "96996620-4", neto: 767755, iva: 145873, total: 913628 },
  { tipo: "FAC-EL", folio: 419, fecha: "2026-06-12", cliente: "Aguas de Antofagasta S.A.", rut: "76418976-0", neto: 2100000, iva: 399000, total: 2499000 },
];

const columns: ColumnDef<Venta>[] = [
  { id: "tipo", accessorKey: "tipo", header: "Tipo", cell: ({ getValue }) => <QavanteBadge variant="info">{getValue() as string}</QavanteBadge> },
  { id: "folio", accessorKey: "folio", header: "Folio", enableColumnFilter: false, meta: { align: "right" }, cell: ({ getValue }) => getValue() as number },
  { id: "fecha", accessorKey: "fecha", header: "Fecha", enableColumnFilter: false, cell: ({ getValue }) => formatDateLike(getValue() as string) },
  { id: "cliente", accessorKey: "cliente", header: "Cliente" },
  { id: "rut", accessorKey: "rut", header: "RUT", cell: ({ getValue }) => <span className="text-neutral-mid">{getValue() as string}</span> },
  { id: "neto", accessorKey: "neto", header: "Neto", enableColumnFilter: false, meta: { align: "right" }, cell: ({ getValue }) => formatClp(getValue() as number) },
  { id: "iva", accessorKey: "iva", header: "IVA", enableColumnFilter: false, meta: { align: "right" }, cell: ({ getValue }) => formatClp(getValue() as number) },
  { id: "total", accessorKey: "total", header: "Total", enableColumnFilter: false, meta: { align: "right" }, cell: ({ getValue }) => formatClp(getValue() as number) },
];

const meta = {
  title: "Propuestas / Tablas dinámicas / Data-grid",
  component: DynamicTable,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DynamicTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Libro de Ventas dinámico: ordená por Total/Fecha, filtrá por Cliente/RUT/Tipo,
 *  y arrastrá los títulos para poner (ej.) Cliente antes que Fecha. */
export const LibroDeVentas: Story = {
  args: {
    columns: columns as ColumnDef<unknown, unknown>[],
    data: data as unknown[],
    initialColumnOrder: ["tipo", "folio", "fecha", "cliente", "rut", "neto", "iva", "total"],
    minWidth: 820,
  },
};
