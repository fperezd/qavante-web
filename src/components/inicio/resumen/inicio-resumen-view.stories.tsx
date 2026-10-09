import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { InicioResumenView } from "./inicio-resumen-view";
import { InicioCreditos } from "./inicio-creditos-live";
import { InicioBancos } from "./inicio-bancos-live";
import { DEFICIT, EVALUATION, NO_DEFICIT, NOW } from "./inicio-resumen.fixtures";
import { MULTI_BANK_ACCOUNTS, MULTI_BANK_CREDITS } from "./inicio-bancos.fixtures";
import { SOLO_TEST_STORYBOOK } from "@/test/storybook/solo-test-storybook";

const meta = {
  title: "Inicio/Resumen aprobado",
  component: InicioResumenView,
  parameters: { layout: "padded" },
  args: {
    data: DEFICIT,
    empresa: "Empresa de ejemplo",
    hoy: NOW,
    liquidityEvaluation: EVALUATION,
    balances: <InicioBancos accounts={MULTI_BANK_ACCOUNTS} now={NOW} />,
    credits: (
      <div className="mt-4 rounded-xl bg-background p-3">
        <p className="mb-3 text-sm font-medium">Líneas de crédito</p>
        <InicioCreditos lines={MULTI_BANK_CREDITS} />
      </div>
    ),
  },
} satisfies Meta<typeof InicioResumenView>;
export default meta;
type Story = StoryObj<typeof meta>;

async function verifyLayout(canvasElement: HTMLElement, mobile: boolean) {
  const canvas = within(canvasElement);
  const sections = canvas.getByTestId("inicio-caja").children;
  await expect(sections[0]).toHaveAttribute("aria-labelledby", "inicio-saldo");
  await expect(sections[1]).toHaveAttribute("aria-labelledby", "inicio-proyeccion");
  const left = sections[0]!.getBoundingClientRect();
  const right = sections[1]!.getBoundingClientRect();
  if (mobile) {
    await expect(right.top).toBeGreaterThanOrEqual(left.bottom);
    await expect(canvas.getByTestId("inicio-resumen").scrollWidth).toBeLessThanOrEqual(
      canvas.getByTestId("inicio-resumen").clientWidth,
    );
  } else {
    await expect(left.width).toBeGreaterThan(right.width);
    await expect(Math.abs(left.top - right.top)).toBeLessThan(1);
  }
}

export const ConDeficit: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 1080, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Requiere atención" })).toBeVisible();
    await expect(canvas.queryByText(/sobre presupuesto/)).not.toBeInTheDocument();
    await expect(canvas.queryByText("Revisión operativa")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Control de decisiones y actividad")).not.toBeInTheDocument();
    await verifyLayout(canvasElement, false);
    const control = canvas.getByRole("button", { name: "Revisar opciones" });
    await expect(control).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(control);
    await expect(canvas.getByText("Alternativas para proteger tu caja")).toBeVisible();
    await verifyLayout(canvasElement, false);
    await userEvent.click(control);
    await expect(control).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByText("Cómo se calcula")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Saldo al final de los 14 días · CLP")).not.toBeInTheDocument();
  },
};
export const SinDeficit: Story = {
  args: { data: NO_DEFICIT, liquidityEvaluation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: "Revisar opciones" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText("Pagos cubiertos")).toBeVisible();
    await expect(canvas.getByText("$16.000.000", { selector: "p" })).toBeVisible();
    await verifyLayout(canvasElement, false);
  },
};
export const SinDatos: Story = {
  args: { data: null, liquidityEvaluation: null, credits: null, balances: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Pagos cubiertos")).not.toBeInTheDocument();
    await expect(canvas.getAllByText("Sin dato").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Proyección por confirmar")).toBeVisible();
  },
};
export const DatosAntiguos: Story = {
  args: {
    data: NO_DEFICIT,
    hoy: new Date("2026-09-15T12:15:00Z"),
    balances: (
      <InicioBancos accounts={MULTI_BANK_ACCOUNTS} now={new Date("2026-09-15T12:15:00Z")} />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Pagos cubiertos")).not.toBeInTheDocument();
    await expect(canvas.getByText(/Proyección pendiente de actualizar/)).toBeVisible();
    await expect(canvas.getByText(/Hay saldos sin actualización de hoy/)).toBeVisible();
  },
};
export const Celular: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  decorators: [
    (Story) => (
      <div style={{ width: 360, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const { page } = await import("@vitest/browser/context");
    await page.viewport(390, 844);
    try {
      await waitFor(() => expect(document.documentElement.clientWidth).toBe(390));
      const canvas = within(canvasElement);
      await verifyLayout(canvasElement, true);
      await page.viewport(390, 844);
      const lines = canvas.getByText("Ver todas las líneas (3)", { selector: "summary" });
      await expect(canvas.getByText(/Santander · 9988 · USD/)).not.toBeVisible();
      await userEvent.click(lines);
      await expect(canvas.getByText(/Santander · 9988 · USD/)).toBeVisible();
      await verifyLayout(canvasElement, true);
      await userEvent.click(lines);
      const accounts = canvas.getByText("Ver saldos por cuenta y fecha", { selector: "summary" });
      await userEvent.click(accounts);
      await expect(canvas.getByText("Banco de Chile · Operación CLP")).toBeVisible();
      await verifyLayout(canvasElement, true);
      await userEvent.click(accounts);
      const options = canvas.getByRole("button", { name: "Revisar opciones" });
      await userEvent.click(options);
      await verifyLayout(canvasElement, true);
      await userEvent.click(options);
    } finally {
      await page.viewport(1280, 800);
    }
  },
};
export const CelularSinDeficit: Story = {
  ...Celular,
  parameters: SOLO_TEST_STORYBOOK,
  args: { data: NO_DEFICIT, liquidityEvaluation: null },
  play: async ({ canvasElement }) => {
    const { page } = await import("@vitest/browser/context");
    await page.viewport(390, 844);
    try {
      await waitFor(() => expect(document.documentElement.clientWidth).toBe(390));
      await verifyLayout(canvasElement, true);
      await expect(within(canvasElement).getByText("Pagos cubiertos")).toBeVisible();
      await page.viewport(390, 844);
    } finally {
      await page.viewport(1280, 800);
    }
  },
};

export const SeguimientoConErrorSinDeficit: Story = {
  args: {
    data: NO_DEFICIT,
    operationPlanError: new Error("Consulta fallida"),
    onRetryOperationPlan: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Ver plan y seguimiento" }));
    await userEvent.click(canvas.getByRole("button", { name: "Actualizar plan" }));
    await expect(args.onRetryOperationPlan).toHaveBeenCalledOnce();
  },
};
export const AccionesFinancieras: Story = {
  args: {
    data: {
      ...DEFICIT,
      priority_actions: [
        {
          priority: 1,
          reason: "Revisar cobro de Factura 123 · Cliente de ejemplo",
          deadline: "Vence el 14-09-2026",
          cta_href: "/cobrar",
          cta_label: "Ver cobro",
          amount: "3500000",
        },
        {
          priority: 2,
          reason: "Revisar pago de Factura 456 · Proveedor de ejemplo",
          deadline: "Vence el 15-09-2026",
          cta_href: "/pagar",
          cta_label: "Ver pago",
          amount: "1200000",
        },
        {
          priority: 3,
          reason: "Revisar conciliación de Factura 789",
          deadline: "Hoy",
          cta_href: "/caja/conciliacion?decision_id=11111111-1111-4111-8111-111111111111",
          cta_label: "Ver conciliación",
          amount: "800000",
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Las CTAs de `priority_actions` viven en la maqueta local de Inicio; en Storybook/CI
       (`APP_ENV≠development`) no se montan. La superficie prod conserva el déficit y el CTA a caja. */
    await expect(canvas.getByRole("heading", { name: "Requiere atención" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Ver proyección de caja/ })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: "Ver cobro" })).not.toBeInTheDocument();
  },
};
