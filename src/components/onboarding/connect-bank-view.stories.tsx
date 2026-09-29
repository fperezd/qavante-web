import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CompanyScopeProvider } from "@/components/shell/company-scope";
import { ConnectBankView } from "./connect-bank-view";

const CONSENT = http.get("*/api/admin/sources/bank_bice/consent", () =>
  HttpResponse.json({ is_valid: true, consent_text_offered: "ok" }, { status: 200 }),
);

const statusHandler = (bank: boolean) =>
  http.get("*/api/onboarding/status", () =>
    HttpResponse.json(
      {
        completed: false,
        completed_at: null,
        steps: { sii_connected: false, bank_connected: bank },
      },
      { status: 200 },
    ),
  );

const LEGAL_ENTITIES = http.get("*/api/legal-entities", () =>
  HttpResponse.json({
    entities: [{ id: "company-story", legal_name: "Empresa de prueba SpA", is_default: true }],
  }),
);

const meta = {
  title: "Capa 2 / Onboarding / ConnectBankView",
  component: ConnectBankView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [CONSENT, LEGAL_ENTITIES, statusHandler(false)] },
  },
  decorators: [
    (Story) => (
      <CompanyScopeProvider>
        <Story />
      </CompanyScopeProvider>
    ),
  ],
} satisfies Meta<typeof ConnectBankView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Widget Fintoc (con 'Conectar después')" };
export const YaConectado: Story = {
  name: "Banco conectado",
  parameters: { msw: { handlers: [CONSENT, LEGAL_ENTITIES, statusHandler(true)] } },
};
