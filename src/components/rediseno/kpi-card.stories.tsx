import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
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
