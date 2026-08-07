import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { PulsoObjetivoSelector } from "./pulso-objetivo-selector";

/* PulsoObjetivoSelector — el dueño elige con qué foco mirar su salud; eso re-pondera los ejes del
   Pulso (el backend calcula, el FE captura). */

const meta = {
  title: "Propuestas / Gestión / PulsoObjetivoSelector",
  component: PulsoObjetivoSelector,
  parameters: { layout: "padded" },
  args: {
    value: "equilibrado",
    onChange: fn(),
  },
} satisfies Meta<typeof PulsoObjetivoSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Equilibrado: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // Los 4 objetivos como radios; "Equilibrado" activo.
    await expect(c.getByRole("radio", { name: "Equilibrado" })).toBeChecked();
    await expect(c.getByRole("radio", { name: "Cuidar la caja" })).not.toBeChecked();
    // El caption explica el foco actual.
    await expect(c.getByText(/foco en/i)).toBeInTheDocument();
    // Elegir otro objetivo avisa al contenedor con su key.
    await userEvent.click(c.getByRole("radio", { name: "Cuidar la caja" }));
    await expect(args.onChange).toHaveBeenCalledWith("cuidar_caja");
  },
};

export const FocoCaja: Story = {
  args: { value: "cuidar_caja" },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("radio", { name: "Cuidar la caja" })).toBeChecked();
    // El caption refleja el objetivo activo (el nombre va en un span en negrita, minúscula).
    await expect(c.getByText("cuidar la caja")).toBeInTheDocument();
    // Click en el activo NO re-dispara onChange (evita persistir de más).
    await userEvent.click(c.getByRole("radio", { name: "Cuidar la caja" }));
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const Guardando: Story = {
  args: { value: "crecer", saving: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // Con saving, los radios quedan deshabilitados.
    await expect(c.getByRole("radio", { name: "Crecer" })).toBeDisabled();
  },
};
