import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ReclamadaBadge } from "./reclamada-badge";

/* "R" de factura reclamada en el SII (#744): transparencia, no excluir en silencio. */

const meta = {
  title: "SII / ReclamadaBadge",
  component: ReclamadaBadge,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ReclamadaBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const r = canvas.getByLabelText("Reclamada en el SII");
    await expect(r).toHaveTextContent("R");
    await expect(r).toHaveAttribute("title", expect.stringContaining("Reclamada en el SII"));
  },
};
