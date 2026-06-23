import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { BankCredentialCard } from "./bank-credential-card";

/* Card de conexión bancaria (BICE) en Administración → Credenciales. Estado vía
   GET /api/credentials/bice; conectar/rotar vía PUT. */

const NOT_CONNECTED = http.get("*/api/credentials/bice", () =>
  HttpResponse.json({ provider: "bice", connected: false }, { status: 200 }),
);
const CONNECTED = http.get("*/api/credentials/bice", () =>
  HttpResponse.json({ provider: "bice", connected: true }, { status: 200 }),
);
const PUT_OK = http.put("*/api/credentials/bice", () => new HttpResponse(null, { status: 200 }));

const meta = {
  title: "Capa 2 / Credenciales / BankCredentialCard",
  component: BankCredentialCard,
  parameters: {
    layout: "centered",
    msw: { handlers: [NOT_CONNECTED, PUT_OK] },
  },
} satisfies Meta<typeof BankCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoConectado: Story = { name: "No conectado (form visible)" };
export const Conectado: Story = {
  parameters: { msw: { handlers: [CONNECTED, PUT_OK] } },
};
