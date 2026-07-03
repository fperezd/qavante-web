import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ConciliacionSueldosView } from "./conciliacion-sueldos-view";
import type { EmployeePayroll } from "./payroll-detalle";
import type { BankDebitLike } from "./payroll-conciliacion";

/* ConciliacionSueldosView — cruza el líquido por empleado contra los débitos del
   banco. Presentacional: recibe los dos conjuntos ya resueltos. */

const EMPLEADOS: EmployeePayroll[] = [
  { id: "1", nombre: "Ana Pérez Soto", rut: "12.345.678-9", liquido: 1200000 },
  { id: "2", nombre: "Benjamín Rojas Díaz", rut: "9.876.543-2", liquido: 1000000 },
  { id: "3", nombre: "Carla Muñoz Vera", rut: "15.111.222-3", liquido: 700000 },
];

const DEBITOS_OK: BankDebitLike[] = [
  { id: "d1", date: "2026-03-05", description: "TRANSFERENCIA SUELDO", amount: "1200000", direction: "debit" },
  { id: "d2", date: "2026-03-05", description: "TRANSFERENCIA SUELDO", amount: "1000000", direction: "debit" },
  { id: "d3", date: "2026-03-05", description: "TRANSFERENCIA SUELDO", amount: "700000", direction: "debit" },
];

const DEBITOS_PARCIAL: BankDebitLike[] = [
  { id: "d1", date: "2026-03-05", description: "TRANSFERENCIA SUELDO", amount: "1200000", direction: "debit" },
  { id: "dx", date: "2026-03-06", description: "PAGO PROVEEDOR ACME", amount: "455000", direction: "debit" },
];

const meta = {
  title: "Capa 2 / Remuneraciones / ConciliacionSueldosView",
  component: ConciliacionSueldosView,
  parameters: { layout: "padded" },
  args: { onPeriodChange: fn(), period: "2026-03" },
} satisfies Meta<typeof ConciliacionSueldosView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodoConciliado: Story = {
  name: "Todo conciliado",
  args: { empleados: EMPLEADOS, movimientos: DEBITOS_OK },
};

export const Parcial: Story = {
  name: "Parcial (faltan pagos + débito sin asignar)",
  args: { empleados: EMPLEADOS, movimientos: DEBITOS_PARCIAL },
};

export const SinPeriodo: Story = {
  name: "Sin período",
  args: { period: null, empleados: [], movimientos: [] },
};

export const DetallePendiente: Story = {
  name: "Falta detalle por empleado (backend pendiente)",
  args: { empleados: [], movimientos: DEBITOS_OK, detalleUnavailable: true },
};

export const Cargando: Story = {
  args: { empleados: [], movimientos: [], loading: true },
};
