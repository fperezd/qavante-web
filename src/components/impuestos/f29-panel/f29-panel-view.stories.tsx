import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { F29PanelView } from "./f29-panel-view";
import {
  f29Year2025,
  f29Year2026,
  f29Year2026AlDia,
  f29Year2026Incremental,
} from "./f29-panel-fixtures";

/* Panel anual de F29 (control de gestión) — prototipo de UX.
   El endpoint real (`GET /api/sii/f29?anio=YYYY`) aún no existe; estas stories
   validan la experiencia con datos de ejemplo. */

const meta = {
  title: "Capa 2 / Impuestos / F29 Panel",
  component: F29PanelView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof F29PanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Año en curso con un F29 vencido impago (Mayo) → alerta roja arriba +
 *  semáforo en la tabla + descuadre vs Libro. Clic en una fila abre el detalle. */
export const Default: Story = {
  args: { data: f29Year2026, anios: [2026, 2025, 2024] },
};

/** Todo al día → sin rojos: se ve el banner de próximo vencimiento. */
export const AlDia: Story = {
  args: { data: f29Year2026AlDia, anios: [2026, 2025, 2024] },
};

/** Entrega incremental del backend: semáforo presente, montos aún sin parsear
 *  (todo "—") — el panel degrada sin romperse. */
export const EntregaIncremental: Story = {
  args: { data: f29Year2026Incremental, anios: [2026, 2025, 2024] },
};

/** Selector de año funcionando (2026 ↔ 2025). */
export const ConSelectorDeAnio: Story = {
  args: { data: f29Year2026, anios: [2026, 2025] },
  render: () => {
    const [anio, setAnio] = React.useState(2026);
    const data = anio === 2025 ? f29Year2025 : f29Year2026;
    return <F29PanelView data={data} anios={[2026, 2025]} onAnioChange={setAnio} />;
  },
};
