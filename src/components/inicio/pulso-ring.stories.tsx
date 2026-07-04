import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PulsoRing } from "./pulso-ring";

const meta = {
  title: "Inicio / PulsoRing",
  component: PulsoRing,
  parameters: {
    docs: {
      description: {
        component:
          "Anillo del Pulso (nivel dios). El score llena el anillo, respira sutilmente y el color comunica el estado de un vistazo. El número cuenta desde 0. Respeta prefers-reduced-motion.",
      },
    },
  },
  args: { score: 60, status: "critical" },
} satisfies Meta<typeof PulsoRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critica: Story = { args: { score: 60, status: "critical" } };
export const Debil: Story = { args: { score: 45, status: "weak" } };
export const Estable: Story = { args: { score: 72, status: "stable" } };
export const Fuerte: Story = { args: { score: 91, status: "strong" } };

export const Panel: Story = {
  name: "Los cuatro estados",
  render: () => (
    <div className="flex flex-wrap gap-6">
      <PulsoRing score={91} status="strong" />
      <PulsoRing score={72} status="stable" />
      <PulsoRing score={45} status="weak" />
      <PulsoRing score={60} status="critical" />
    </div>
  ),
};
