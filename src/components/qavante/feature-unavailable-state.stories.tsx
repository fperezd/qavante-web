import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FeatureUnavailableState } from "./feature-unavailable-state";

const meta = {
  title: "Capa 1 / FeatureUnavailableState",
  component: FeatureUnavailableState,
  parameters: {
    docs: {
      description: {
        component:
          "Estado canónico para pantallas del Addendum Frontend v2.0 gateadas por feature flag OFF / backend no conectado (addendum §20 + §23.1, ADR-0008). Wrapper fino de `QavanteEmpty`. Regla dura: nunca UI mock, nunca ruta rota — siempre mensaje de negocio (Anexo F).",
      },
    },
  },
} satisfies Meta<typeof FeatureUnavailableState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const EstructuraGestion: Story = {
  args: {
    title: "Estructura de gestión — todavía no disponible",
    description:
      "Cuando conectemos tu información vas a poder ordenar acá tus ingresos, costos, gastos, caja y obligaciones, partiendo de una base sugerida.",
  },
};

export const Monedas: Story = {
  args: {
    title: "Monedas — todavía no disponible",
    description:
      "Acá vas a definir la moneda principal de tu empresa y las monedas en que querés ver tus reportes.",
  },
};
