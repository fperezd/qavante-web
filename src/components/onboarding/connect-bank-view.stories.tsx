import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConnectBankView } from "./connect-bank-view";

/* Paso 4 — Conectar banco (BICE). Paso informativo + opcional (la conexión web
   self-serve es contrato pendiente de backend). `useRouter` auto-mock. */

const meta = {
  title: "Capa 2 / Onboarding / ConnectBankView",
  component: ConnectBankView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof ConnectBankView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Conectar banco" };
