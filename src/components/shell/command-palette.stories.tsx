import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect, waitFor } from "storybook/test";
import { CommandPalette } from "./command-palette";

/* CommandPalette (⌘K) — navegación 100% por teclado. El popup se renderea en un
   PORTAL (Base UI Dialog) → los tests de `play` consultan `document.body`. */

function Wrapper() {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="p-8">
      <button type="button" onClick={() => setOpen(true)}>
        Abrir paleta
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} userRole="owner" />
    </div>
  );
}

const meta = {
  title: "Capa 2 / Shell / CommandPalette",
  component: CommandPalette,
  // `nextjs.appDirectory`: monta el mock del App Router (el componente usa useRouter).
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  args: { open: true, onOpenChange: () => {} },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Abierto: Story = { render: () => <Wrapper /> };

/** Test de interacción (browser real): ↓/↑ mueven la opción activa y Escape cierra. */
export const TecladoNavega: Story = {
  render: () => <Wrapper />,
  play: async () => {
    const body = within(document.body); // el popup vive en un portal
    const options = await body.findAllByRole("option");
    await expect(options.length).toBeGreaterThan(1);
    // La primera opción arranca activa.
    await expect(options[0]!).toHaveAttribute("aria-selected", "true");

    // ↓ mueve a la segunda; ↑ vuelve a la primera.
    await userEvent.keyboard("{ArrowDown}");
    await expect(options[1]!).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}");
    await expect(options[0]!).toHaveAttribute("aria-selected", "true");

    // Escape cierra el diálogo (desaparece del DOM tras la animación de salida).
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
  },
};
