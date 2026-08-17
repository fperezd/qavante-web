import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AliasesAprendidos } from "./aliases-aprendidos";

const meta = {
  title: "Capa 2 / Caja / Conciliación / AliasesAprendidos",
  component: AliasesAprendidos,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AliasesAprendidos>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConEvidencia: Story = {
  args: {
    aliases: [
      {
        id: "alias-activo",
        pattern: "TRANSFERENCIA COMERCIAL LOS ANDES",
        counterparty_rut: "76123456-7",
        direction: "credit",
        source: "learned",
        confirmations: 2,
        last_used_at: "2026-08-15T14:30:00Z",
        created_at: "2026-08-01T11:00:00Z",
      },
      {
        id: "alias-pendiente",
        pattern: "PAGO DISTRIBUIDORA DEL SUR",
        counterparty_rut: "76543210-1",
        direction: "debit",
        source: "learned",
        confirmations: 1,
        last_used_at: null,
        created_at: "2026-08-14T09:00:00Z",
      },
    ],
  },
};

export const SinEvidencia: Story = { args: { aliases: [] } };
