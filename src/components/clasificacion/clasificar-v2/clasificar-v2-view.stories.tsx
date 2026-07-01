import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ClasificarV2View, type ClasificarV2Data } from "./clasificar-v2-view";

/* PROPUESTA UX — "Por clasificar" v2 (`/caja/por-clasificar`).
   Progreso (% clasificado), orden por monto, selección múltiple + clasificar en
   lote, y sugerencia con nivel de confianza por fila (confirmar en vez de elegir
   desde cero). Probá los checkboxes para ver la barra de acción en lote. */

const data: ClasificarV2Data = {
  total_movements: 68,
  items: [
    { id: "1", date: "2026-06-28", glosa: "TRANSFERENCIA A DISTRIBUIDORA ANDINA", amount: "-2499000", suggested_account: "Costos > Insumos", confidence: 0.92 },
    { id: "2", date: "2026-06-27", glosa: "PAGO PAC MERCADOLIBRE", amount: "-58990", suggested_account: "Gastos > Software y suscripciones", confidence: 0.87 },
    { id: "3", date: "2026-06-26", glosa: "DEPOSITO CLIENTE 76418976", amount: "5486914", suggested_account: "Ingresos > Ventas", confidence: 0.95 },
    { id: "4", date: "2026-06-25", glosa: "COMISION MANTENCION CUENTA", amount: "-9900", suggested_account: "Gastos > Comisiones bancarias", confidence: 0.78 },
    { id: "5", date: "2026-06-24", glosa: "TRANSFERENCIA VARIOS 4821", amount: "-1350000", suggested_account: null, confidence: null },
    { id: "6", date: "2026-06-23", glosa: "PAGO SERVICIOS BASICOS ENEL", amount: "-189500", suggested_account: "Gastos > Servicios básicos", confidence: 0.64 },
  ],
};

const meta = {
  title: "Propuestas / Clasificación / Por clasificar v2",
  component: ClasificarV2View,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClasificarV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConSugerencias: Story = { args: { data } };
