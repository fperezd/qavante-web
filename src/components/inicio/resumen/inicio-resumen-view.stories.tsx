import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { InicioResumenView } from "./inicio-resumen-view";
import { InicioCreditoLinea } from "./inicio-creditos-live";
import { BUDGET, DEFICIT, EVALUATION, NO_DEFICIT, NOW } from "./inicio-resumen.fixtures";

const meta = {
  title: "Inicio/Resumen aprobado",
  component: InicioResumenView,
  parameters: { layout: "padded" },
  args: {
    data: DEFICIT,
    empresa: "Empresa de ejemplo",
    hoy: NOW,
    budget: BUDGET,
    budgetPeriod: "2026-08",
    liquidityEvaluation: EVALUATION,
    activities: [],
    credits: (
      <div className="mt-3 space-y-3 rounded-xl bg-background p-3 text-sm">
        <p className="text-xs text-neutral-mid">Líneas de crédito · BICE</p>
        <InicioCreditoLinea account="1234" currency="CLP" available={4000000} total={6000000} />
      </div>
    ),
  },
} satisfies Meta<typeof InicioResumenView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ConDeficit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Faltante proyectado · CLP")).toBeVisible();
    await expect(canvas.getByText(/Gastos · agosto de 2026/)).toBeVisible();
    const sections = canvas.getByTestId("inicio-caja").children;
    await expect(sections[0]).toHaveAttribute("aria-labelledby", "inicio-proyeccion");
    const control = canvas.getByText("Evaluar decisión", { selector: "summary" });
    await expect(control.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(control);
    await expect(control.closest("details")).toHaveAttribute("open");
    await expect(canvas.getByText("Alternativas para proteger tu caja")).toBeVisible();
    await userEvent.click(control);
    await expect(control.closest("details")).not.toHaveAttribute("open");
    const comparison = canvas.getByText("Ver comparación", { selector: "summary" });
    await expect(canvas.getByText("Presupuestado", { selector: "dt" })).not.toBeVisible();
    await userEvent.click(comparison);
    await expect(canvas.getByText("Presupuestado", { selector: "dt" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Ver detalle en Presupuesto" })).toHaveAttribute(
      "href",
      "/presupuesto",
    );
    await userEvent.click(comparison);
    await expect(comparison.closest("details")).not.toHaveAttribute("open");
  },
};
export const SinDeficit: Story = {
  args: { data: NO_DEFICIT, liquidityEvaluation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Evaluar decisión")).not.toBeInTheDocument();
    await expect(canvas.getByText(/Sin necesidad de caja informada/)).toBeVisible();
    await expect(canvas.getByText(/Gastos · agosto de 2026/)).toBeVisible();
    await expect(canvas.getByTestId("inicio-caja").children[0]).toHaveAttribute(
      "aria-labelledby",
      "inicio-saldo",
    );
  },
};
export const SinDatos: Story = {
  args: { data: null, budget: null, liquidityEvaluation: null, credits: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Sin necesidad de caja informada/)).not.toBeInTheDocument();
    await expect(canvas.getAllByText("Sin dato").length).toBeGreaterThan(0);
  },
};
export const DatosAntiguos: Story = {
  args: {
    data: NO_DEFICIT,
    hoy: new Date("2026-09-15T12:15:00Z"),
    budget: { ...BUDGET, data_state: "partial" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Sin necesidad de caja informada/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/sobre presupuesto/)).not.toBeInTheDocument();
    await expect(canvas.getByText(/Proyección pendiente de actualizar/)).toBeVisible();
  },
};
export const Celular: Story = {
  ...ConDeficit,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
