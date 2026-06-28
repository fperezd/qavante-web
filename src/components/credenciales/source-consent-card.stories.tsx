import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { SourceConsentCard } from "./source-consent-card";

/* Consentimiento de fuente (SII). `GET/POST /api/admin/sources/{code}/consent`. */

const MISSING = http.get("*/api/admin/sources/:code/consent", () =>
  HttpResponse.json(
    {
      source_code: "sii_rcv",
      is_valid: false,
      consent_text_offered:
        "Autorizo a Qavante a acceder al SII en nombre de mi empresa, solo lectura, para traer mis documentos tributarios.",
      consent_version_offered: "v1",
    },
    { status: 200 },
  ),
);
const GRANTED = http.get("*/api/admin/sources/:code/consent", () =>
  HttpResponse.json(
    {
      id: "c1",
      tenant_id: "t1",
      source_code: "sii_rcv",
      consent_text: "Autorizo…",
      consent_version: "v1",
      accepted_at: "2026-06-28T12:00:00Z",
      expires_at: "2027-06-28T12:00:00Z",
      is_valid: true,
      days_to_expiry: 365,
    },
    { status: 200 },
  ),
);
const ACCEPT = http.post("*/api/admin/sources/:code/consent", () =>
  HttpResponse.json({ status: "ok" }, { status: 201 }),
);

const meta = {
  title: "Capa 2 / Credenciales / SourceConsentCard",
  component: SourceConsentCard,
  args: { sourceCode: "sii_rcv", label: "Autorización de acceso al SII" },
  parameters: { layout: "centered", msw: { handlers: [MISSING, ACCEPT] } },
} satisfies Meta<typeof SourceConsentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FaltaAutorizar: Story = { name: "Falta autorizar" };
export const Autorizada: Story = {
  parameters: { msw: { handlers: [GRANTED, ACCEPT] } },
};
