import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CompanyScopeProvider } from "@/components/shell/company-scope";
import { BankCredentialCard } from "./bank-credential-card";

const CONSENT = http.get("*/api/admin/sources/bank_bice/consent", () =>
  HttpResponse.json({ is_valid: true }, { status: 200 }),
);

const LEGAL_ENTITIES = http.get("*/api/legal-entities", () =>
  HttpResponse.json({
    entities: [{ id: "company-story", legal_name: "Empresa de prueba SpA", is_default: true }],
  }),
);

const meta = {
  title: "Capa 2 / Credenciales / BankCredentialCard",
  component: BankCredentialCard,
  parameters: {
    layout: "centered",
    msw: { handlers: [CONSENT, LEGAL_ENTITIES] },
  },
  decorators: [
    (Story) => (
      <CompanyScopeProvider>
        <Story />
      </CompanyScopeProvider>
    ),
  ],
} satisfies Meta<typeof BankCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WidgetFintoc: Story = { name: "Widget Fintoc" };
