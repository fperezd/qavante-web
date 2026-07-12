import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { SiiPersonCredentialCard } from "./sii-person-credential-card";

/* Card de la clave del representante SII — la que baja el DTE por clave (facturas
   como PDF, #553). Antes solo en el onboarding; acá se (re)ingresa/rota cuando la
   sesión del SII caduca. */

const meta = {
  title: "Capa 2 / Credenciales / SiiPersonCredentialCard",
  component: SiiPersonCredentialCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Permite cargar/rotar la clave del representante legal (persona autorizada) en el SII, necesaria para descargar los DTE como PDF. Dialog lazy `SiiPersonCredentialDialog`.",
      },
    },
  },
} satisfies Meta<typeof SiiPersonCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interaccion: Story = {
  name: "Explica para qué sirve + CTA configurar",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Clave del representante (SII)")).toBeInTheDocument();
    await expect(canvas.getByText(/descargar tus DTE|facturas emitidas y recibidas/)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Configurar" })).toBeInTheDocument();
  },
};
