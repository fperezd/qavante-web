import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { WidgetPersonalizar } from "./widget-personalizar";

/* WidgetPersonalizar — el dueño prende/apaga las tarjetas del Inicio (mover ya lo hace DraggableCard). */

const WIDGETS = [
  { id: "caja", label: "Caja proyectada" },
  { id: "cobranza", label: "Cobranza realizable" },
  { id: "pagos", label: "Pagos del mes" },
  { id: "resultado", label: "Resultado" },
];

const meta = {
  title: "Propuestas / Inicio v2 / WidgetPersonalizar",
  component: WidgetPersonalizar,
  parameters: { layout: "padded" },
  args: { widgets: WIDGETS, hidden: ["pagos"], onToggle: fn() },
} satisfies Meta<typeof WidgetPersonalizar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrenderApagar: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // El panel arranca cerrado.
    await expect(c.queryByRole("group")).not.toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: /Personalizar/ }));
    // Abierto: 3 de 4 encendidas (pagos apagado).
    await expect(c.getByText(/3 de 4 encendidas/)).toBeInTheDocument();
    // Cada widget es un switch; "Pagos del mes" está apagado.
    await expect(c.getByRole("switch", { name: /Pagos del mes/ })).not.toBeChecked();
    await expect(c.getByRole("switch", { name: /Caja proyectada/ })).toBeChecked();
    // Prender "Pagos" avisa al contenedor con su id.
    await userEvent.click(c.getByRole("switch", { name: /Pagos del mes/ }));
    await expect(args.onToggle).toHaveBeenCalledWith("pagos");
    // Apagar "Caja" también.
    await userEvent.click(c.getByRole("switch", { name: /Caja proyectada/ }));
    await expect(args.onToggle).toHaveBeenCalledWith("caja");
  },
};

export const TodasEncendidas: Story = {
  args: { hidden: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /Personalizar/ }));
    await expect(c.getByText(/4 de 4 encendidas/)).toBeInTheDocument();
  },
};
