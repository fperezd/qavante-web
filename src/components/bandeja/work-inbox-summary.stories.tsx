import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkInboxSummaryView } from "./work-inbox-summary";

const meta = {
  title: "Bandeja/Work inbox",
  component: WorkInboxSummaryView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof WorkInboxSummaryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuatroColas: Story = {
  args: {
    inbox: {
      generated_at: "2026-09-21T10:00:00Z",
      legal_entity_id: "11111111-1111-4111-8111-111111111111",
      priorities: [
        {
          id: "factura-1",
          title: "Andes SpA · Factura 884",
          amount: "1250000.00",
          currency: "CLP",
          relevant_date: "2026-09-18",
          urgency: "overdue",
          status: "overdue",
          href: "/documentos/receivable/factura-1",
          queue: "receivables",
        },
      ],
      queues: [
        sampleQueue("reconciliation", "Conciliar", 3, [{ currency: "CLP", amount: "450000" }]),
        sampleQueue("receivables", "Cobrar", 8, [
          { currency: "CLP", amount: "1250000" },
          { currency: "USD", amount: "80.25" },
        ]),
        sampleQueue("payables", "Pagar", 5, [{ currency: "CLP", amount: "910000" }]),
        sampleQueue("classification", "Clasificar", 11, [{ currency: "CLP", amount: "330000" }]),
      ],
    },
  },
};

function sampleQueue(
  kind: "reconciliation" | "receivables" | "payables" | "classification",
  label: string,
  count: number,
  amounts: { currency: string | null; amount: string }[],
) {
  return {
    kind,
    label,
    action_label: `Abrir ${label.toLowerCase()}`,
    href: "/bandeja",
    count,
    amounts,
    data_state: "available" as const,
    limitations: [],
    next_date: "2026-09-21",
    items: [],
  };
}
