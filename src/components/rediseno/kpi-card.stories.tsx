import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { KpiCard } from "./kpi-card";

const meta = {
  title: "Rediseño / KpiCard",
  component: KpiCard,
  parameters: { layout: "padded" },
  args: { label: "KPI", value: "$0" },
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Entra · 14 días",
    value: "+$14.498.964",
    tone: "ok",
    detail: "cobros con fecha + recurrente",
  },
};

export const ConPeriodoYRojo: Story = {
  args: {
    label: "Hoy",
    period: "BICE · 00:12 ✓",
    value: "−$1.121.250",
    tone: "bad",
    detail: "mismo número en Banco y Hoy",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("BICE · 00:12 ✓")).toBeVisible();
    await expect(canvas.getByText("−$1.121.250")).toBeVisible();
  },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard
        label="Hoy"
        period="BICE · 00:12 ✓"
        value="−$1.121.250"
        tone="bad"
        detail="mismo número en Banco y Hoy"
      />
      <KpiCard
        label="Entra · 14 días"
        value="+$14.498.964"
        tone="ok"
        detail="cobros con fecha + recurrente"
      />
      <KpiCard label="Sale · 14 días" value="−$35.532.396" detail="$1,0M postergable" />
    </div>
  ),
};

/* U6 — el caso Cobrar: sin la fuente de vencimientos, la tarjeta "Vencido"
 * mostraba $0 y 0%. Ahora dice que no sabe, y el ⓘ dice por qué. */
export const SinDatoEnVezDeCero: Story = {
  /* `render` en vez de `args`: el meta declara `value`, y anularlo con
     `value: undefined` sería justo la salida silenciosa que el tipo ahora
     prohíbe. Componer la tarjeta a mano ejercita el call site real. */
  render: () => (
    <KpiCard
      label="Vencido"
      sinDato={{
        reason: "El registro de compras y ventas del SII no trae fechas de vencimiento.",
        missingSources: ["Vencimientos del RCV"],
      }}
      detail="no es cero: todavía no lo sabemos"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Lo importante es lo que NO se ve: ningún cero inventado.
    await expect(canvas.queryByText("$0")).toBeNull();
    await expect(canvas.getByText("sin dato")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Por qué no sabemos vencido" }));
    const panel = await canvas.findByRole("tooltip");
    await expect(within(panel).getByText(/Vencimientos del RCV/)).toBeVisible();
  },
};

/** Una tríada mezclando cifras reales con un "no sé": el contraste es el punto. */
export const GridConSinDato: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard label="Por cobrar" value="$39.612.480" detail="147 documentos" />
      <KpiCard
        label="Vencido"
        sinDato={{
          reason: "El registro de compras y ventas del SII no trae fechas de vencimiento.",
          missingSources: ["Vencimientos del RCV"],
        }}
        detail="no es cero: todavía no lo sabemos"
      />
      <KpiCard
        label="Días promedio de mora"
        sinDato={{ missingSources: ["Vencimientos del RCV"] }}
        detail="se calcula con las fechas de vencimiento"
      />
    </div>
  ),
};
