import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OpeningBalanceView } from "./opening-balance-view";

/* Paso 6 — Saldo de apertura. Monto manual opcional (CLP). `useRouter`
   auto-mock (appDirectory). El POST solo corre al continuar con monto. */

const meta = {
  title: "Capa 2 / Onboarding / OpeningBalanceView",
  component: OpeningBalanceView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof OpeningBalanceView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Saldo de apertura" };
