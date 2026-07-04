import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteStatTile } from "./qavante-stat-tile";

const meta = {
  title: "Capa 1 / QavanteStatTile",
  component: QavanteStatTile,
  parameters: {
    docs: {
      description: {
        component:
          "Tile de KPI unificado (Ola 2). Un solo tratamiento del número (tamaño, peso, tabular-nums) para las pantallas de dinero, en vez del `Metric`/`InfoCard` que cada una reinventaba. El color del valor comunica significado (positivo/negativo/alerta). `size='hero'` para el número protagonista.",
      },
    },
  },
  args: {
    label: "Total por cobrar",
    value: "$54.320.000",
  },
} satisfies Meta<typeof QavanteStatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

export const Danger: Story = {
  name: "Alerta (vencido)",
  args: { label: "Vencido", value: "$4.180.000", tone: "danger" },
};

export const Negative: Story = {
  name: "Negativo (menos tipográfico)",
  args: { label: "Resultado del mes", value: "−$1.240.000", tone: "danger" },
};

export const WithHint: Story = {
  name: "Con frescura",
  args: { label: "Caja hoy", value: "$18.500.000", hint: "Actualizado 04-07-2026 08:21" },
};

export const Hero: Story = {
  name: "Tamaño hero",
  args: { label: "Líquido a pagar", value: "$14.982.804", size: "hero" },
};

export const Grid: Story = {
  name: "Grilla de KPIs",
  render: () => (
    <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
      <QavanteStatTile label="Total por pagar" value="$22.700.000" />
      <QavanteStatTile label="Próx. 7 días" value="$8.150.000" tone="danger" />
      <QavanteStatTile label="Próx. 14 días" value="$12.400.000" />
      <QavanteStatTile label="Próx. 30 días" value="$18.900.000" />
    </div>
  ),
};
