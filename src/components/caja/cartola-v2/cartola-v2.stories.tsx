import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect, waitFor } from "storybook/test";
import { ResumenKpis } from "./resumen-kpis";
import { MovimientosGrid } from "./movimientos-grid";

/* PROPUESTA UX — "Cartola nivel dios" (/caja). Toma lo mejor de la banca (resumen
   de KPIs con ⓘ + grilla aireada) y lo eleva: montos exactos (−$X), tooltips
   accesibles por teclado, sparklines, count-up y una frase de historia. */

function CartolaV2() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 bg-surface-muted p-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Cartola</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Cuenta Corriente MN · N° 07-04222-1 · 29 may – 30 jun 2026
        </p>
      </header>
      <ResumenKpis storyline="Este mes salió $5,6M más de lo que entró — el pago de la tarjeta ($1M) y el F29 de mayo ($2,5M) pesaron. La cuenta cerró en rojo, cubierta con el sobregiro." />
      <MovimientosGrid />
    </div>
  );
}

const meta = {
  title: "Propuestas / Caja / Cartola nivel dios",
  component: ResumenKpis,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResumenKpis>;

export default meta;
type Story = StoryObj<typeof meta>;

/** La pantalla completa: resumen (hero + KPIs con ⓘ + sparklines) + movimientos. */
export const CartolaCompleta: Story = { render: () => <CartolaV2 /> };

/** Solo el resumen. */
export const SoloResumen: Story = {
  render: () => (
    <div className="mx-auto max-w-[1100px] bg-surface-muted p-6">
      <ResumenKpis storyline="Cerró en rojo, cubierta con el sobregiro." />
    </div>
  ),
};

/** Test de interacción (browser real): el ⓘ se abre por TECLADO (no solo hover) —
 *  mejor que la banca (solo-hover). */
export const TooltipAccesible: Story = {
  render: () => <CartolaV2 />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const hints = canvas.getAllByRole("button", { name: /Qué significa/i });
    // Enfocar el ⓘ de "Saldo final" abre el tooltip (sin mouse).
    hints[0]!.focus();
    await waitFor(() => expect(body.getByText(/al cierre del período/i)).toBeVisible());
  },
};

/** Test de interacción: al hacer clic en un movimiento, la fila se expande y
 *  muestra el detalle + el seguimiento (timeline). */
export const FilaExpandible: Story = {
  render: () => <CartolaV2 />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filas = canvas.getAllByRole("button", { expanded: false });
    // La primera fila-movimiento (el resumen no tiene filas expandibles).
    const fila = filas.find((b) => /Cargo Intereses Sobregiro/i.test(b.textContent ?? ""))!;
    await userEvent.click(fila);
    await expect(fila).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(canvas.getByText("Seguimiento")).toBeVisible());
    await expect(canvas.getByText("Detectado en tu banco")).toBeVisible();
  },
};
