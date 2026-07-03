import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { EmpleadoDetalle } from "./empleado-detalle";
import type { EmployeeSlim } from "./buk-format";

/* EmpleadoDetalle — panel modal con los datos slim del empleado (BUK). */

const ANA: EmployeeSlim = {
  id: "1",
  fullName: "Ana Pérez Soto",
  rut: "12.345.678-9",
  email: "ana@empresa.cl",
  role: "Analista de Finanzas",
  gender: "F",
  active: true,
};

const meta = {
  title: "Capa 2 / Remuneraciones / EmpleadoDetalle",
  component: EmpleadoDetalle,
  parameters: { layout: "fullscreen" },
  args: { onClose: fn() },
} satisfies Meta<typeof EmpleadoDetalle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Activo: Story = {
  args: { employee: ANA },
};

export const Inactivo: Story = {
  args: { employee: { ...ANA, fullName: "Elena Torres Gil", active: false, gender: "F", role: "Vendedora" } },
};

export const ConCamposFaltantes: Story = {
  name: "Con campos faltantes",
  args: {
    employee: { id: "9", fullName: "Sin Datos Completos", rut: null, email: null, role: null, gender: null, active: null },
  },
};
