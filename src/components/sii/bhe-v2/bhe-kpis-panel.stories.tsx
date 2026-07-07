import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BheKpisPanel } from "./bhe-kpis-panel";
import type { BheRecibida } from "@/lib/api/sii";

/* Panel BHE (Honorarios) — montado arriba de la tabla. Retención acumulada como
   KPI con CTA al F29 + concentración por profesional. FE-only, excluye anuladas. */

const items = [
  {
    fecha_emision: "2026-06-05",
    nombre_emisor: "Ana Pérez Contadora",
    rut_emisor: "12345678-9",
    folio: 812,
    monto_bruto: 1200000,
    retencion: 165000,
    monto_liquido: 1035000,
    anulada: false,
  },
  {
    fecha_emision: "2026-06-12",
    nombre_emisor: "Luis Soto Diseño",
    rut_emisor: "13456789-0",
    folio: 340,
    monto_bruto: 650000,
    retencion: 89375,
    monto_liquido: 560625,
    anulada: false,
  },
  {
    fecha_emision: "2026-06-20",
    nombre_emisor: "Ana Pérez Contadora",
    rut_emisor: "12345678-9",
    folio: 815,
    monto_bruto: 800000,
    retencion: 110000,
    monto_liquido: 690000,
    anulada: false,
  },
  {
    fecha_emision: "2026-06-24",
    nombre_emisor: "Estudio Jurídico Ramírez",
    rut_emisor: "76222333-4",
    folio: 55,
    monto_bruto: 1500000,
    retencion: 206250,
    monto_liquido: 1293750,
    anulada: false,
  },
] as BheRecibida[];

const meta = {
  title: "Capa 2 / SII / BHE KPIs",
  component: BheKpisPanel,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BheKpisPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Junio2026: Story = { args: { items, periodo: "Junio 2026" } };
