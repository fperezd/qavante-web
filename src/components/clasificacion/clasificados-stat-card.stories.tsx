import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ClasificadosStatCard } from "./clasificados-stat-card";

const meta = {
  title: "Capa 2 / Clasificación / ClasificadosStatCard",
  component: ClasificadosStatCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Métrica individual del bloque 'Resumen de movimientos clasificados'. Sin borde propio (vive dentro del card del padre). Estados: info-only, clickeable (role=button + foco), activa (ring brand + bg tinte), muted (filtro hermano la hace tautológica). Tonos neutral/success/warning.",
      },
    },
  },
  args: {
    label: "Total clasificados",
    value: "1.284",
  },
} satisfies Meta<typeof ClasificadosStatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoOnly: Story = {
  name: "Info (sin interacción)",
};

export const Interactive: Story = {
  name: "Clickeable",
  args: {
    label: "Ingresos",
    value: "$3.450.000",
    tone: "success",
    onClick: fn(),
    actionLabel: "Filtrar por ingresos",
  },
};

export const ActiveFilter: Story = {
  name: "Filtro activo",
  args: {
    label: "Ingresos",
    value: "$3.450.000",
    tone: "success",
    onClick: fn(),
    active: true,
    sublabel: "Filtro activo · clic para quitar",
    actionLabel: "Quitar filtro de ingresos",
  },
};

export const Muted: Story = {
  name: "Muted (tautológica por filtro hermano)",
  args: {
    label: "Egresos",
    value: "$0",
    onClick: fn(),
    muted: true,
    sublabel: "Sin egresos con el filtro actual",
  },
};

export const ToneWarning: Story = {
  name: "Tono warning",
  args: {
    label: "Requieren revisión",
    value: "12",
    tone: "warning",
  },
};

export const ValorLargoTruncado: Story = {
  name: "Valor largo (truncado)",
  args: {
    label: "Mayor movimiento",
    value: "$1.284.560.000.000",
    tooltip: "$1.284.560.000.000",
  },
};
