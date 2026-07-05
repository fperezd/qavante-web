import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { EmpresasView } from "./empresas-view";

/* Administración → Empresas: lista de empresas + crear una nueva. */

const list = http.get("*/api/me/tenants", () =>
  HttpResponse.json({
    tenants: [
      { id: "t1", slug: "tooxs", legal_name: "Tooxs Digital SpA", role: "owner", is_active: true },
      { id: "t2", slug: "otra", legal_name: "Otra Empresa Ltda", role: "admin", is_active: false },
    ],
  }),
);

const meta = {
  title: "Capa 2 / Administración / EmpresasView",
  component: EmpresasView,
  parameters: { layout: "padded", msw: { handlers: [list] } },
} satisfies Meta<typeof EmpresasView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lista: Story = {};
