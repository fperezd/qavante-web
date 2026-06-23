import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CompanySwitcher } from "./company-switcher";

/* Selector de empresa (N:M, ADR-0049). Lista empresas, cambia la activa y crea
   una nueva. `GET /api/me/tenants` para poblar. */

const MULTI = http.get("*/api/me/tenants", () =>
  HttpResponse.json(
    {
      tenants: [
        {
          id: "t1",
          slug: "tooxs",
          legal_name: "Tooxs Digital SpA",
          role: "owner",
          is_active: true,
        },
        {
          id: "t2",
          slug: "otra",
          legal_name: "Otra Empresa Ltda",
          role: "admin",
          is_active: false,
        },
      ],
    },
    { status: 200 },
  ),
);
const ONE = http.get("*/api/me/tenants", () =>
  HttpResponse.json(
    {
      tenants: [
        {
          id: "t1",
          slug: "tooxs",
          legal_name: "Tooxs Digital SpA",
          role: "owner",
          is_active: true,
        },
      ],
    },
    { status: 200 },
  ),
);

const meta = {
  title: "Capa 2 / Shell / CompanySwitcher",
  component: CompanySwitcher,
  parameters: {
    layout: "centered",
    msw: { handlers: [MULTI] },
  },
} satisfies Meta<typeof CompanySwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VariasEmpresas: Story = { name: "Varias empresas" };
export const UnaEmpresa: Story = {
  name: "Una empresa",
  parameters: { msw: { handlers: [ONE] } },
};
