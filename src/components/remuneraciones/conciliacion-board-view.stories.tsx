import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { ConciliacionBoardView } from "./conciliacion-board-view";
import { normalizeBoard, type DebitoCandidato } from "./settlement-board-model";

/* ConciliacionBoardView — conciliación de sueldos accionable (#835): asignar (una-a-una / varias
   marcadas) y desasignar. Presentacional PURO con callbacks (el POST lo hace el contenedor). */

const BOARD = normalizeBoard({
  period_outstanding: "4000000",
  workers: [
    {
      worker_rut: "12.345.678-9",
      worker_name: "Ana Pérez Soto",
      liquido: "2500000",
      paid_amount: "0",
      outstanding: "2500000",
      status: "pendiente",
    },
    {
      worker_rut: "9.876.543-2",
      worker_name: "Benjamín Rojas Díaz",
      liquido: "1500000",
      paid_amount: "0",
      outstanding: "1500000",
      status: "pendiente",
    },
  ],
  links: [
    {
      link_id: "lnk_carrasco",
      worker_rut: "20.009.075-6",
      worker_name: "Carrasco",
      amount: "1000000",
      bank_movement_id: "bm_fp",
      glosa: "TRANSFERENCIA A FERNANDO PEREZ",
      created_at: "2026-07-31T10:00:00Z",
    },
  ],
});

const CANDIDATOS: DebitoCandidato[] = [
  { id: "bm_sueldos", date: "2026-05-30", glosa: "SUELDO FERNANDO PEREZ MAYO", monto: 2_500_000 },
  { id: "bm_transf", date: "2026-05-29", glosa: "TRANSFERENCIA NÓMINA", monto: 1_500_000 },
];

const meta = {
  title: "Propuestas / Remuneraciones / ConciliacionBoardView",
  component: ConciliacionBoardView,
  parameters: { layout: "padded" },
  args: {
    periodLabel: "Mayo 2026",
    board: BOARD,
    candidatos: CANDIDATOS,
    onAssign: fn(),
    onRevert: fn(),
  },
} satisfies Meta<typeof ConciliacionBoardView>;

export default meta;
type Story = StoryObj<typeof meta>;

/* Asignar una-a-una: elegir un débito + un trabajador → Conciliar → Confirmar → onAssign. */
export const AsignarUnaAUna: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Conciliar sueldos")).toBeInTheDocument();
    // Elige el débito.
    await userEvent.click(c.getByRole("radio", { name: /SUELDO FERNANDO PEREZ MAYO/ }));
    // Marca al trabajador.
    await userEvent.click(c.getByRole("checkbox", { name: /Ana Pérez Soto/ }));
    // Conciliar → panel de confirmación explícito (mueve plata → nunca de un clic).
    await userEvent.click(c.getByRole("button", { name: /^Conciliar/ }));
    await expect(c.getByText(/Asignar/)).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: /Confirmar conciliación/ }));
    await expect(args.onAssign).toHaveBeenCalledWith("bm_sueldos", ["12.345.678-9"]);
  },
};

/* Varias marcadas: un débito + N trabajadores → onAssign con los N ruts. */
export const VariasMarcadas: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("radio", { name: /SUELDO FERNANDO PEREZ MAYO/ }));
    await userEvent.click(c.getByRole("checkbox", { name: /Ana Pérez Soto/ }));
    await userEvent.click(c.getByRole("checkbox", { name: /Benjamín Rojas Díaz/ }));
    await userEvent.click(c.getByRole("button", { name: /^Conciliar/ }));
    await expect(c.getByText(/2 trabajadores/)).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: /Confirmar conciliación/ }));
    await expect(args.onAssign).toHaveBeenCalledWith("bm_sueldos", ["12.345.678-9", "9.876.543-2"]);
  },
};

/* Desasignar (caso Carrasco ↔ transferencia a Fernando Pérez): botón por fila conciliada → onRevert. */
export const Desasignar: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText("TRANSFERENCIA A FERNANDO PEREZ")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: /Desasignar/ }));
    await expect(args.onRevert).toHaveBeenCalledWith("lnk_carrasco");
  },
};
