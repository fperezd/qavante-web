import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { SiiPersonCredentialCard } from "./sii-person-credential-card";

/* Card de la clave del representante SII — la que baja el DTE por clave (facturas
   como PDF, #553). Prop-driven: el RUT registrado queda persistido (de
   `GET /api/credentials/sii`). */

const meta = {
  title: "Capa 2 / Credenciales / SiiPersonCredentialCard",
  component: SiiPersonCredentialCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Carga/rota la clave del representante legal en el SII (necesaria para descargar DTE como PDF). Muestra el RUT registrado de forma persistente. Dialog lazy.",
      },
    },
  },
} satisfies Meta<typeof SiiPersonCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinConfigurar: Story = {
  args: { persons: [] },
};

export const Configurado: Story = {
  args: {
    persons: [
      { rut: "12.345.678-9", name: "Fernando Pérez", configured: true, last_rotated_at: "2026-07-12T10:00:00Z" },
    ],
  },
};

export const SinConfigurarInteraccion: Story = {
  name: "Sin clave → explica + CTA Ingresar",
  args: { persons: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Clave del representante (SII)")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Ingresar clave" })).toBeInTheDocument();
  },
};

export const ConfiguradoInteraccion: Story = {
  name: "Con clave → muestra RUT registrado",
  args: { ...Configurado.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12.345.678-9")).toBeInTheDocument();
    await expect(canvas.getByText("Configurada")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Actualizar clave" })).toBeInTheDocument();
  },
};
