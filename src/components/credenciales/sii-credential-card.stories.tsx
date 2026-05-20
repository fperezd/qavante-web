import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SiiCredentialCard } from "./sii-credential-card";
import type { CredentialMetadataResponse } from "@/lib/api/credentials";

const meta = {
  title: "Capa 2 / Credenciales / SiiCredentialCard",
  component: SiiCredentialCard,
  parameters: {
    docs: {
      description: {
        component:
          "Card del bloque ÚNICO de credencial SII (Opción A, `source_code=sii_rcv`). Estados configurada/no configurada con CTAs. El dialog asociado es `SiiCredentialDialog` lazy. NO existe lista de personas (fuera de scope).",
      },
    },
    layout: "padded",
  },
} satisfies Meta<typeof SiiCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const base: CredentialMetadataResponse = {
  source_code: "sii_rcv",
  provider: "sii",
  purpose: "ingest",
  label: "Clave Tributaria SII",
  expected_keys: ["rut", "password"],
  human_label: "Clave del SII",
  is_active: false,
  created_at: "2026-05-19T00:00:00Z",
} as CredentialMetadataResponse;

export const NotConfigured: Story = {
  args: { credential: { ...base, is_active: false } },
};

export const Configured: Story = {
  args: {
    credential: { ...base, is_active: true, created_at: "2026-05-18T10:00:00Z" },
  },
};
