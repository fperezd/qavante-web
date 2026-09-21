import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { BankCredentialCard } from "./bank-credential-card";

const CONSENT = http.get("*/api/admin/sources/bank_bice/consent", () =>
  HttpResponse.json({ is_valid: true }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Credenciales / BankCredentialCard",
  component: BankCredentialCard,
  parameters: {
    layout: "centered",
    msw: { handlers: [CONSENT] },
  },
} satisfies Meta<typeof BankCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WidgetFintoc: Story = { name: "Widget Fintoc" };
