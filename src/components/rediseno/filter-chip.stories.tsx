import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { FilterChips } from "./filter-chip";

type FiltroId = "prioridad" | "vencido" | "60d" | "aldia";

const OPTIONS: ReadonlyArray<{ id: FiltroId; label: string; count: number }> = [
  { id: "prioridad", label: "Prioridad", count: 15 },
  { id: "vencido", label: "Vencido", count: 12 },
  { id: "60d", label: "+60 días", count: 5 },
  { id: "aldia", label: "Al día", count: 3 },
];

function Wrapper() {
  const [active, setActive] = React.useState<FiltroId>("prioridad");
  return <FilterChips options={OPTIONS} value={active} onChange={setActive} />;
}

const meta = {
  title: "Rediseño / FilterChips",
  component: FilterChips<FiltroId>,
  parameters: { layout: "padded" },
  args: { options: OPTIONS, value: "prioridad", onChange: () => {} },
} satisfies Meta<typeof FilterChips<FiltroId>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grupo: Story = {
  render: () => <Wrapper />,
};

export const SiempreConConteo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("radio", { name: "Prioridad · 15" })).toBeVisible();
  },
};

/** Radiogroup real: click cambia la selección, y las flechas navegan con wrap
 *  y foco — mismo patrón que `direction-segment.tsx`. */
export const NavegacionPorTeclado: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prioridad = canvas.getByRole("radio", { name: "Prioridad · 15" });
    const vencido = canvas.getByRole("radio", { name: "Vencido · 12" });
    const aldia = canvas.getByRole("radio", { name: "Al día · 3" });

    await expect(prioridad).toHaveAttribute("aria-checked", "true");

    await userEvent.click(vencido);
    await expect(vencido).toHaveAttribute("aria-checked", "true");
    await expect(prioridad).toHaveAttribute("aria-checked", "false");

    vencido.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(prioridad).toHaveAttribute("aria-checked", "true");
    await expect(prioridad).toHaveFocus();

    // wrap: desde el primero, ← va al último.
    await userEvent.keyboard("{ArrowLeft}");
    await expect(aldia).toHaveAttribute("aria-checked", "true");
  },
};
