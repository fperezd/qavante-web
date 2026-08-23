import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { Chrome } from "./chrome";

const ITEMS = [
  { label: "Hoy", href: "/" },
  { label: "Caja", href: "/caja" },
  { label: "Banco", href: "/banco" },
  { label: "Cobrar", href: "/cobrar" },
  { label: "Pagar", href: "/pagar" },
  { label: "Impuestos", href: "/impuestos" },
  { label: "Gestión", href: "/gestion" },
  { label: "Presupuesto", href: "/presupuesto" },
];

const meta = {
  title: "Rediseño / Chrome",
  component: Chrome,
  parameters: { layout: "fullscreen" },
  args: {
    items: ITEMS,
    activeHref: "/",
    bandejaCount: 3,
    criticalAlertCount: 0,
    userInitials: "FP",
  },
} satisfies Meta<typeof Chrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConAlertaCritica: Story = {
  args: { criticalAlertCount: 1 },
};

/** El item activo lleva aria-current + estilo bold; la campana solo cuenta lo
 *  crítico accionable, nunca el total de alertas (Ley 2). */
export const EstadoActivoYBadges: Story = {
  args: { activeHref: "/cobrar", bandejaCount: 3, criticalAlertCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cobrar = canvas.getByText("Cobrar").closest("a");
    await expect(cobrar).toHaveAttribute("aria-current", "page");

    const hoy = canvas.getByText("Hoy").closest("a");
    await expect(hoy).not.toHaveAttribute("aria-current", "page");

    await expect(canvas.getByText("Bandeja · 3")).toBeVisible();
    await expect(canvas.getByLabelText("1 alertas críticas")).toBeVisible();
  },
};

/** `renderLink` recibe `active` — el consumidor (ej. `next/link` en Fase 2)
 *  tiene que poder replicar `aria-current` en su propio wrapper. */
export const ConRenderLinkCustom: Story = {
  args: {
    activeHref: "/caja",
    renderLink: (item, active, children) => (
      <a
        href={item.href}
        data-testid={`link-${item.href}`}
        aria-current={active ? "page" : undefined}
      >
        {children}
      </a>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("link-/caja")).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByTestId("link-/")).not.toHaveAttribute("aria-current", "page");
  },
};
