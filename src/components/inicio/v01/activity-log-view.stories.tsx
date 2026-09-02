import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import { ActivityLogView } from "./activity-log-view";

const meta = {
  title: "Inicio/V01/Mientras no estabas",
  component: ActivityLogView,
  parameters: { layout: "padded", a11y: { test: "error" } },
  args: {
    activities: [
      {
        actionId: "accion-1",
        resumen: "Clasificó 14 movimientos del banco con una regla.",
        creadaEn: "2026-09-01T12:00:00Z",
        venceEn: "2026-09-08T12:00:00Z",
        deshacerDisponible: true,
        deshacerResultado: null,
      },
    ],
    onUndo: fn(),
    detailLinks: true,
  },
} satisfies Meta<typeof ActivityLogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConAccionDeshacible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Deshacer" })).toBeEnabled();
    await expect(canvas.getByRole("link", { name: "Ver" })).toBeInTheDocument();
  },
};

export const Vacia: Story = {
  args: { activities: [], onUndo: undefined, detailLinks: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Aún no hay automatismos reversibles/i),
    ).toBeInTheDocument();
  },
};

export const ErrorHonesto: Story = {
  args: { activities: null, error: true, onUndo: undefined, onRetry: fn(), detailLinks: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/No sabemos qué hizo Qavante/i),
    ).toBeInTheDocument();
  },
};
