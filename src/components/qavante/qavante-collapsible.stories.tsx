import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteCollapsible } from "./qavante-collapsible";

const meta = {
  title: "Capa 1 / QavanteCollapsible",
  component: QavanteCollapsible,
  parameters: {
    docs: {
      description: {
        component:
          "Disclosure accesible (expandir/ocultar). Controlado o no controlado. `aria-expanded` + `aria-controls`, animación de altura con la técnica grid 0fr→1fr y respeto a `prefers-reduced-motion`.",
      },
    },
  },
  args: {
    title: "¿Qué incluye este plan?",
    children:
      "Acceso completo, soporte prioritario y reportes avanzados. La sección se expande y colapsa con animación, accesible por teclado.",
  },
} satisfies Meta<typeof QavanteCollapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cerrado: Story = {};

export const Abierto: Story = {
  args: { defaultOpen: true },
};
