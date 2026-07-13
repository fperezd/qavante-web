import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { DraggableCard } from "./draggable-card";
import { moveItem } from "./widget-order";

/* DraggableCard — asa de reordenamiento de las tarjetas del Inicio v2. Mouse por
   HTML5 DnD; teclado por los botones ↑/↓ (el DnD nativo no es accesible). La
   persistencia vive en la vista live; acá se prueba el reordenamiento por teclado
   con estado local. Story de render puro (sin args): DraggableCard es interactivo
   y se compone dentro de un demo con estado. */

const meta: Meta = {
  title: "Inicio v2 / DraggableCard",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

function Demo() {
  const [ids, setIds] = React.useState(["Caja proyectada", "Cobranza realizable", "Pagos del mes"]);
  const move = (from: number, to: number) => setIds((prev) => moveItem(prev, from, to));
  return (
    <div className="grid max-w-md gap-3 sm:grid-cols-2">
      {ids.map((label, i) => (
        <DraggableCard key={label} label={label} index={i} count={ids.length} onMove={move}>
          <div
            data-testid="card"
            className="rounded-xl border border-border bg-surface p-6 text-sm font-medium text-neutral-dark"
          >
            {label}
          </div>
        </DraggableCard>
      ))}
    </div>
  );
}

export const Reordenable: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const orderNow = () => canvas.getAllByTestId("card").map((el) => el.textContent);

    // Orden inicial.
    await expect(orderNow()).toEqual(["Caja proyectada", "Cobranza realizable", "Pagos del mes"]);

    // La primera tarjeta no puede subir; sí bajar. Enfocar revela la toolbar
    // (focus-within) igual que para un usuario de teclado → el control es clickeable.
    await expect(canvas.getByRole("button", { name: /Mover “Caja proyectada” hacia arriba/ })).toBeDisabled();
    const bajarCaja = canvas.getByRole("button", { name: /Mover “Caja proyectada” hacia abajo/ });
    bajarCaja.focus();
    await userEvent.click(bajarCaja);

    // Caja bajó una posición.
    await expect(orderNow()).toEqual(["Cobranza realizable", "Caja proyectada", "Pagos del mes"]);

    // La última tarjeta no puede bajar.
    await expect(canvas.getByRole("button", { name: /Mover “Pagos del mes” hacia abajo/ })).toBeDisabled();
  },
};
