import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { BukCredentialCard } from "./buk-credential-card";

/* Token de BUK (Remuneraciones). `GET/POST /api/admin/sources/buk/credential`. */

const NOT_CONFIGURED = http.get("*/api/admin/sources/buk/credential", () =>
  HttpResponse.json(
    {
      source_code: "buk",
      provider: "buk",
      purpose: "api_token",
      human_label: "Token de BUK",
      expected_keys: ["api_token"],
      is_active: false,
    },
    { status: 200 },
  ),
);
const CONFIGURED = http.get("*/api/admin/sources/buk/credential", () =>
  HttpResponse.json(
    {
      source_code: "buk",
      provider: "buk",
      purpose: "api_token",
      human_label: "Token de BUK",
      expected_keys: ["api_token"],
      is_active: true,
      updated_at: "2026-07-03T12:00:00Z",
    },
    { status: 200 },
  ),
);
const SAVE = http.post("*/api/admin/sources/buk/credential", () =>
  HttpResponse.json({ status: "ok" }, { status: 201 }),
);

const meta = {
  title: "Capa 2 / Credenciales / BukCredentialCard",
  component: BukCredentialCard,
  parameters: { layout: "centered", msw: { handlers: [NOT_CONFIGURED, SAVE] } },
} satisfies Meta<typeof BukCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoConfigurado: Story = { name: "No configurado" };
export const Configurado: Story = {
  parameters: { msw: { handlers: [CONFIGURED, SAVE] } },
};
