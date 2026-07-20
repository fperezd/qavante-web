import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CobranzaAcciones } from "./cobranza-acciones";

/* Acciones reales de cobranza: copiar recordatorio, WhatsApp/mail, marcar gestionado. */

const meta = {
  title: "Propuestas / Cobrar / CobranzaAcciones",
  component: CobranzaAcciones,
  parameters: { layout: "padded" },
  args: {
    onCopiar: () => {},
    onToggleGestionado: () => {},
    waHref: "https://wa.me/?text=hola",
    mailtoHref: "mailto:?subject=Cobranza",
  },
} satisfies Meta<typeof CobranzaAcciones>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pendiente: Story = {
  args: { copiado: false, gestionado: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Copiar recordatorio/ })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Marcar gestionado/ })).toBeInTheDocument();
    // Links sin destinatario (no CRM): comparten el texto, el gerente elige el contacto.
    await expect(canvas.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("target", "_blank");
  },
};

export const Copiado: Story = {
  args: { copiado: true, gestionado: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Copiado/ })).toBeInTheDocument();
  },
};

export const Gestionado: Story = {
  args: { copiado: false, gestionado: "2026-07-20" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Ya gestionado → la acción ofrece reabrir.
    await expect(canvas.getByRole("button", { name: /Reabrir/ })).toBeInTheDocument();
  },
};
