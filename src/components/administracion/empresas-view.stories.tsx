import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CompanyScopeProvider } from "@/components/shell/company-scope";
import { EmpresasView } from "./empresas-view";

/* Administración → Empresas operativas del tenant actual. */

const list = http.get("*/api/legal-entities", () =>
  HttpResponse.json({
    entities: [
      { id: "e1", legal_name: "Tooxs Digital SpA", is_default: true },
      { id: "e2", legal_name: "Otra Empresa Ltda", is_default: false },
    ],
  }),
);

const meta = {
  title: "Capa 2 / Administración / EmpresasView",
  component: EmpresasView,
  parameters: { layout: "padded", msw: { handlers: [list] } },
  decorators: [(Story) => <CompanyScopeProvider><Story /></CompanyScopeProvider>],
} satisfies Meta<typeof EmpresasView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lista: Story = {};
