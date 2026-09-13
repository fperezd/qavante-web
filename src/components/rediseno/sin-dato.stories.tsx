import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { SinDato } from "./sin-dato";

const meta = {
  title: "Rediseño / SinDato",
  component: SinDato,
  parameters: { layout: "padded" },
  args: { reason: "Todavía no tenemos las fechas de vencimiento." },
} satisfies Meta<typeof SinDato>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "el monto vencido",
    reason: "El SII no entrega fechas de vencimiento en el registro de compras y ventas.",
    missingSources: ["Vencimientos del RCV"],
  },
};

/** En celda de tabla el texto largo rompe la grilla: "Sin información" y el ⓘ al lado. */
export const Compacto: Story = {
  args: {
    variant: "compact",
    label: "los días de mora",
    missingSources: ["Vencimientos del RCV"],
  },
};

/** No es un cero: se lee distinto, en gris y en cursiva, con el ⓘ al lado. */
export const NoSeVeComoUnCero: Story = {
  args: { label: "el monto vencido", reason: "Falta la fuente de vencimientos." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("sin dato")).toBeVisible();
    await expect(canvas.queryByText("$0")).toBeNull();
    await expect(canvas.queryByText("0")).toBeNull();
  },
};

/** El ⓘ revela el motivo Y la fuente que falta (Ley 8), y vuelve a cerrarse. */
export const ElInfoRevelaElMotivo: Story = {
  args: {
    label: "el monto vencido",
    reason: "El registro de compras y ventas del SII no trae fechas de vencimiento.",
    missingSources: ["Vencimientos del RCV", "Cartola BICE"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const info = canvas.getByRole("button", { name: "Por qué no sabemos el monto vencido" });

    await expect(info).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("tooltip")).toBeNull();

    await userEvent.click(info);
    const panel = await canvas.findByRole("tooltip");
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(
      within(panel).getByText(/no trae fechas de vencimiento/i, { exact: false }),
    ).toBeVisible();
    // Las dos fuentes del backend se muestran tal cual, no se resumen.
    await expect(within(panel).getByText(/Vencimientos del RCV · Cartola BICE/)).toBeVisible();
    await expect(within(panel).getByText(/Fuentes que faltan/)).toBeVisible();

    await userEvent.click(info);
    await expect(canvas.queryByRole("tooltip")).toBeNull();
  },
};

/**
 * Escape cierra y devuelve el foco al ⓘ: sin esto el teclado queda huérfano.
 *
 * El decoy "Otro control" no es decorativo: al abrir con click el foco ya queda
 * en el ⓘ, así que sin mover el foco a otra parte la aserción final pasaría en
 * vacío — pasaría igual aunque el componente no devolviera el foco. Sacarle el
 * foco antes de Escape es lo único que hace observable el retorno.
 */
export const EscapeCierraYDevuelveElFoco: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <SinDato label="el monto vencido" missingSources={["Vencimientos del RCV"]} />
      <button type="button">Otro control</button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const info = canvas.getByRole("button", { name: "Por qué no sabemos el monto vencido" });
    const otro = canvas.getByRole("button", { name: "Otro control" });

    await userEvent.click(info);
    await expect(await canvas.findByRole("tooltip")).toBeVisible();

    // El foco se va a otro lado, como cuando el usuario sigue tabulando.
    otro.focus();
    await expect(otro).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("tooltip")).toBeNull();
    await expect(info).toHaveFocus();
  },
};

/**
 * Los tipos no pueden prohibir `reason=""` (haría falta un genérico condicional
 * que rompe la inferencia en cada call site). Cuando el motivo llega vacío, el
 * panel lo dice — no queda mudo, que es el bug que este primitivo vino a matar.
 */
export const MotivoVacioNoQuedaMudo: Story = {
  args: { label: "el monto vencido", reason: "   ", missingSources: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Por qué no sabemos el monto vencido" }),
    );
    const panel = await canvas.findByRole("tooltip");
    await expect(within(panel).getByText(/No tenemos registrado el motivo/)).toBeVisible();
    await expect(within(panel).queryByText(/Fuente/)).toBeNull();
  },
};

/** Con una sola fuente el rótulo va en singular. */
export const UnaSolaFuente: Story = {
  args: { label: "el saldo del banco", missingSources: ["Cartola BICE"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Por qué no sabemos el saldo del banco" }),
    );
    const panel = await canvas.findByRole("tooltip");
    await expect(within(panel).getByText(/Fuente que falta/)).toBeVisible();
    await expect(within(panel).queryByText(/Fuentes que faltan/)).toBeNull();
  },
};
