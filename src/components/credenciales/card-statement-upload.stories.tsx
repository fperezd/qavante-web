import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CardStatementUpload } from "./card-statement-upload";

/* Subir cartola de tarjeta (PDF). `POST /api/treasury/card-statements/import`
   (multipart). */

const OK = http.post("*/api/treasury/card-statements/import", () =>
  HttpResponse.json(
    {
      type: "international",
      needs_review: 2,
      purchases_upserted: 7,
      charges_detected: 1,
      payment_detected: "350000",
      deuda_total_usd: "1240.50",
      pagar_hasta: "2026-07-05",
    },
    { status: 200 },
  ),
);

const meta = {
  title: "Capa 2 / Credenciales / CardStatementUpload",
  component: CardStatementUpload,
  parameters: {
    layout: "centered",
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof CardStatementUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Subir: Story = {};
