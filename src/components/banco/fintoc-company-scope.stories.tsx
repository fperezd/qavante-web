import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { http, HttpResponse } from "msw";
import { BancosConectadosPanel } from "./bancos-conectados-panel";
import { FintocBankActions } from "./fintoc-bank-actions";
import { CompanyScopeProvider } from "@/components/shell/company-scope";
import { ACTIVE_COMPANY_STORAGE_KEY } from "@/lib/company/active-company";

const COMPANY_ID = "company-first-render";

const handlers = [
  http.get("*/api/legal-entities", () =>
    HttpResponse.json({
      entities: [{ id: COMPANY_ID, legal_name: "Empresa de prueba SpA", is_default: true }],
    }),
  ),
  http.get("*/api/admin/sources/bank/consent", () => HttpResponse.json({ is_valid: true })),
  http.get("*/api/fintoc/connections", ({ request }) => {
    if (request.headers.get("X-Qavante-Company-Id") !== COMPANY_ID) {
      return HttpResponse.json({ detail: "missing explicit company scope" }, { status: 400 });
    }
    return HttpResponse.json([
      {
        id: "connection-1",
        institution_id: "cl_banco_de_chile",
        institution_name: "Banco de Chile",
        holder_id: null,
        holder_rut: null,
        holder_name: null,
        holder_type: "business",
        status: "connected",
        mode: "live",
        data_source: "fintoc",
      },
    ]);
  }),
];

function Scope({ children }: { children: ReactNode }) {
  return <CompanyScopeProvider>{children}</CompanyScopeProvider>;
}

const meta = {
  title: "Capa 2 / Banco / Scope Fintoc",
  parameters: { layout: "padded", msw: { handlers } },
  loaders: [
    async () => {
      window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <Scope>
        <Story />
      </Scope>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * First-render regression: the handler rejects a request that relies on
 * localStorage before the provider has persisted its resolved company.
 */
export const ConexionesSinStorageInicial: Story = {
  render: () => <BancosConectadosPanel />,
  play: async ({ canvas }) => {
    await expect(canvas.findByText("Banco de Chile")).resolves.toBeVisible();
  },
};

export const AccionesSinStorageInicial: Story = {
  render: () => <FintocBankActions />,
  play: async ({ canvas }) => {
    await expect(
      canvas.findByRole("button", { name: "Actualizar cuentas" }),
    ).resolves.toBeVisible();
  },
};
