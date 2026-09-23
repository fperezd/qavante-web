import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CompanyScopeProvider } from "./company-scope";
import { CompanySwitcher } from "./company-switcher";

const entities = (items: Array<{ id: string; legal_name: string; is_default: boolean }>) =>
  http.get("*/api/legal-entities", () => HttpResponse.json({ entities: items }));

const MULTI = entities([
  { id: "company-1", legal_name: "Tooxs Digital SpA", is_default: true },
  { id: "company-2", legal_name: "Otra Empresa Ltda", is_default: false },
]);

const ONE = entities([{ id: "company-1", legal_name: "Tooxs Digital SpA", is_default: true }]);

const meta = {
  title: "Capa 2 / Shell / CompanySwitcher",
  component: CompanySwitcher,
  decorators: [
    (Story) => (
      <CompanyScopeProvider>
        <Story />
      </CompanyScopeProvider>
    ),
  ],
  parameters: {
    layout: "centered",
    msw: { handlers: [MULTI] },
  },
} satisfies Meta<typeof CompanySwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VariasEmpresas: Story = { name: "Varias empresas", args: {} };
export const UnaEmpresa: Story = {
  name: "Una empresa",
  args: {},
  parameters: { msw: { handlers: [ONE] } },
};
