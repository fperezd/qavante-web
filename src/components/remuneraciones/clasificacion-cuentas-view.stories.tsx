import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, screen, expect, userEvent, fn } from "storybook/test";
import { ClasificacionCuentasView } from "./clasificacion-cuentas-view";
import type { CuentaOption } from "./payroll-cuentas";
import type { WorkerClassification } from "@/lib/api/payroll-workers";

/* Clasificación de remuneraciones por empleado (ADR-0079 v2): reparto por cuenta + split + fechado. */

const OPTIONS: CuentaOption[] = [
  { code: "direct_cost.direct_labor", label: "Mano de obra directa", grupo: "costo" },
  {
    code: "operating_expense.admin_payroll",
    label: "Remuneraciones administración",
    grupo: "gasto",
  },
];

const MONTHS = [
  { value: "2026-07", label: "julio 2026" },
  { value: "2026-06", label: "junio 2026" },
  { value: "2026-05", label: "mayo 2026" },
];

const WORKERS: WorkerClassification[] = [
  {
    worker_rut: "6906706-0",
    worker_name: "Fernando Pérez",
    costo_empresa: "6906706",
    allocations: [],
  },
  {
    worker_rut: "2915291-1",
    worker_name: "Mirko González",
    costo_empresa: "2915291",
    allocations: [
      {
        account_code: "direct_cost.direct_labor",
        account_name: "Mano de obra directa",
        pct: "100",
      },
    ],
  },
];

const meta = {
  title: "Capa 2 / Remuneraciones / ClasificacionCuentasView",
  component: ClasificacionCuentasView,
  parameters: { layout: "padded" },
  args: {
    options: OPTIONS,
    months: MONTHS,
    unclassifiedCount: 1,
    onAssign: fn(),
    onBulkAssign: fn(),
    workers: WORKERS,
  },
} satisfies Meta<typeof ClasificacionCuentasView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConSinClasificar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Fernando Pérez")).toBeInTheDocument();
    await expect(canvas.getByText(/1 sin clasificar/)).toBeInTheDocument();
    // Mirko ya está clasificado (muestra su cuenta).
    await expect(canvas.getByText("Mano de obra directa")).toBeInTheDocument();
    // Abrir el diálogo de Fernando (sin clasificar) → elegir cuenta → guardar.
    await userEvent.click(canvas.getByRole("button", { name: /Clasificar a Fernando/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.selectOptions(
      dialog.getByRole("combobox", { name: /Cuenta del reparto 1/ }),
      "operating_expense.admin_payroll",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    // onAssign(rut, allocations 100%, effective_from = mes actual por defecto).
    await expect(args.onAssign).toHaveBeenCalledWith(
      "6906706-0",
      [{ account_code: "operating_expense.admin_payroll", pct: 100 }],
      "2026-07",
    );
  },
};

export const Split: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Editar a Mirko → repartir 60/40 en dos cuentas.
    await userEvent.click(canvas.getByRole("button", { name: /Clasificar a Mirko/ }));
    const dialog = within(await screen.findByRole("dialog"));
    // Fila 1 = su cuenta actual (100%). Bajar a 60 y agregar la segunda al 40.
    const pct1 = dialog.getByRole("spinbutton", { name: /Porcentaje del reparto 1/ });
    await userEvent.clear(pct1);
    await userEvent.type(pct1, "60");
    await userEvent.click(dialog.getByRole("button", { name: /Agregar cuenta/ }));
    await userEvent.selectOptions(
      dialog.getByRole("combobox", { name: /Cuenta del reparto 2/ }),
      "operating_expense.admin_payroll",
    );
    const pct2 = dialog.getByRole("spinbutton", { name: /Porcentaje del reparto 2/ });
    await userEvent.type(pct2, "40");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    await expect(args.onAssign).toHaveBeenCalledWith(
      "2915291-1",
      [
        { account_code: "direct_cost.direct_labor", pct: 60 },
        { account_code: "operating_expense.admin_payroll", pct: 40 },
      ],
      "2026-07",
    );
  },
};

export const Ordenable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const orden = () => canvas.getAllByRole("row").map((r) => r.textContent ?? "");
    const idx = (rows: string[], name: string) => rows.findIndex((t) => t.includes(name));
    // Default curado = costo empresa desc → Fernando ($6,9M) va antes que Mirko ($2,9M).
    const inicial = orden();
    await expect(idx(inicial, "Fernando")).toBeLessThan(idx(inicial, "Mirko"));
    // Un clic en "Costo empresa" invierte a asc → Mirko primero.
    await userEvent.click(canvas.getByRole("button", { name: /Ordenar por Costo empresa/ }));
    const asc = orden();
    await expect(idx(asc, "Mirko")).toBeLessThan(idx(asc, "Fernando"));
  },
};

export const TodosClasificados: Story = {
  args: {
    unclassifiedCount: 0,
    workers: [WORKERS[1]!],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Todos clasificados")).toBeInTheDocument();
  },
};
