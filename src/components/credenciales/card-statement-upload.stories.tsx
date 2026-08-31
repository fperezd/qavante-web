import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { expect, userEvent, within } from "storybook/test";
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

/* issue #94: `charges_detected: 1` en la fixture YA ejercitaba el caso N=1 antes de este PR, pero
 * nadie lo afirmaba — el defecto vivo ("1 cargos detectados") pasaba inadvertido en Storybook
 * porque la historia nunca subía un archivo. Este play lo hace y lo afirma. */
export const CargoDetectadoSingular: Story = {
  name: "1 cargo detectado (issue #94, N=1)",
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["%PDF-1.4"], "cartola.pdf", { type: "application/pdf" });
    await userEvent.upload(input, pdf);
    await userEvent.click(c.getByRole("button", { name: /subir cartola/i }));
    await expect(await c.findByText("1 cargo detectado")).toBeInTheDocument();
    await expect(c.queryByText("1 cargos detectados")).not.toBeInTheDocument();
    // [control positivo] el resto de la respuesta (7 compras) sigue en plural.
    await expect(c.getByText("7 compras registradas")).toBeInTheDocument();
  },
};
