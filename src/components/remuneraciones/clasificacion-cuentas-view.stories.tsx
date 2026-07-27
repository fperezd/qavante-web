import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { ClasificacionCuentasView } from "./clasificacion-cuentas-view";
import type { CuentaOption } from "./payroll-cuentas";

/* Clasificación de remuneraciones por empleado (ADR-0079): costo de servicio vs gasto. */

const OPTIONS: CuentaOption[] = [
  { code: "direct_cost.direct_labor", label: "Mano de obra directa", grupo: "costo" },
  {
    code: "operating_expense.admin_payroll",
    label: "Remuneraciones administración",
    grupo: "gasto",
  },
];

const meta = {
  title: "Capa 2 / Remuneraciones / ClasificacionCuentasView",
  component: ClasificacionCuentasView,
  parameters: { layout: "padded" },
  args: {
    options: OPTIONS,
    unclassifiedCount: 1,
    onAssign: fn(),
    onBulkAssign: fn(),
    workers: [
      {
        worker_rut: "6906706-0",
        worker_name: "Fernando Pérez",
        costo_empresa: "6906706",
        account_code: null,
        account_name: null,
      },
      {
        worker_rut: "2915291-1",
        worker_name: "Mirko González",
        costo_empresa: "2915291",
        account_code: "direct_cost.direct_labor",
        account_name: "Mano de obra directa",
      },
    ],
  },
} satisfies Meta<typeof ClasificacionCuentasView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConSinClasificar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Los trabajadores se listan + el aviso de sin clasificar.
    await expect(canvas.getByText("Fernando Pérez")).toBeInTheDocument();
    await expect(canvas.getByText(/1 sin clasificar/)).toBeInTheDocument();
    // Asignar una cuenta en la fila de Fernando → onAssign(rut, code).
    const sel = canvas.getByRole("combobox", { name: /Cuenta de Fernando/ });
    await userEvent.selectOptions(sel, "operating_expense.admin_payroll");
    await expect(args.onAssign).toHaveBeenCalledWith(
      "6906706-0",
      "operating_expense.admin_payroll",
    );
  },
};

export const Masivo: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Seleccionar un trabajador → aparece la barra de lote.
    await userEvent.click(canvas.getByRole("checkbox", { name: /Seleccionar Fernando/ }));
    await expect(canvas.getByText(/1 seleccionado/)).toBeInTheDocument();
    // Elegir cuenta del lote + asignar → onBulkAssign(ruts, code).
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Cuenta para los seleccionados" }),
      "direct_cost.direct_labor",
    );
    await userEvent.click(canvas.getByRole("button", { name: /Asignar a 1/ }));
    await expect(args.onBulkAssign).toHaveBeenCalledWith(["6906706-0"], "direct_cost.direct_labor");
  },
};

export const TodosClasificados: Story = {
  args: {
    unclassifiedCount: 0,
    workers: [
      {
        worker_rut: "2915291-1",
        worker_name: "Mirko González",
        costo_empresa: "2915291",
        account_code: "direct_cost.direct_labor",
        account_name: "Mano de obra directa",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Todos clasificados")).toBeInTheDocument();
  },
};
