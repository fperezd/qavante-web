import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { DteActions } from "./dte-actions";

/* Acciones de un DTE (ver preview + descargar). El preview usa
   `<object type="application/pdf">` con fallback honesto: si el backend no
   entrega un PDF válido, muestra un mensaje + botón de descarga (en vez del
   ícono críptico de imagen rota). El popover se portalea a document.body. */

const meta = {
  title: "Capa 2 / SII / DteActions",
  component: DteActions,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DteActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConUrl: Story = {
  args: { url: "https://api.qavante.com/api/sii/dte-emitidos/pdf?folio=377", label: "377" },
};

export const SinUrl: Story = {
  name: "Sin URL (guion)",
  args: { url: null },
};

/* El preview abre al enfocar el ojo y muestra el object con su fallback
   (mensaje + descarga) — la salida honesta cuando el PDF no se puede ver. */
export const PreviewConFallback: Story = {
  args: { url: "https://api.qavante.com/api/sii/dte-emitidos/pdf?folio=377", label: "377" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    // El foco en el ojo abre el popover (portaleado a document.body).
    canvas.getByRole("button", { name: /Vista previa del DTE/i }).focus();
    const dialog = await waitFor(() =>
      body.getByRole("dialog", { name: /Vista previa del DTE/i }),
    );
    // El fallback honesto (mensaje + descarga) vive dentro del diálogo.
    const inDialog = within(dialog);
    // El fetch del PDF falla en el test env (sin backend) → tras el loading,
    // cae al fallback honesto (mensaje + descarga).
    await waitFor(
      () => expect(inDialog.getByText("No pudimos mostrar la vista previa")).toBeInTheDocument(),
      { timeout: 8000 },
    );
    await expect(inDialog.getByRole("link", { name: /Descargar DTE/i })).toBeInTheDocument();
  },
};
