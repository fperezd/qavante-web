import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { within, expect, userEvent, waitFor } from "storybook/test";
import { PreviredCredentialCard } from "./previred-credential-card";

/* Credencial de Previred (ADR-0070). `GET/POST /api/admin/sources/previred/credential`.
   El backend declara `expected_keys = (username, password)`: username = RUT del REPRESENTANTE
   LEGAL, password = su clave Previred. */

const META = {
  source_code: "previred",
  provider: "previred",
  purpose: "login",
  human_label: "Previred (RUT del Representante Legal + clave)",
  expected_keys: ["username", "password"],
};

const NOT_CONFIGURED = http.get("*/api/admin/sources/previred/credential", () =>
  HttpResponse.json({ ...META, is_active: false }, { status: 200 }),
);
const CONFIGURED = http.get("*/api/admin/sources/previred/credential", () =>
  HttpResponse.json({ ...META, is_active: true, updated_at: "2026-07-16T12:00:00Z" }, { status: 200 }),
);
const SAVE = http.post("*/api/admin/sources/previred/credential", () =>
  HttpResponse.json({ status: "ok" }, { status: 201 }),
);

const meta = {
  title: "Capa 2 / Credenciales / PreviredCredentialCard",
  component: PreviredCredentialCard,
  parameters: { layout: "centered", msw: { handlers: [NOT_CONFIGURED, SAVE] } },
  decorators: [(Story) => <div style={{ width: 560 }}><Story /></div>],
} satisfies Meta<typeof PreviredCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinConfigurar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument());
    await expect(canvas.getByText(/representante legal \(no el de la empresa\)/i)).toBeInTheDocument();
    // Sin datos válidos, no se puede conectar.
    await expect(canvas.getByRole("button", { name: /Conectar Previred/ })).toBeDisabled();
  },
};

export const YaConfigurada: Story = {
  parameters: { msw: { handlers: [CONFIGURED, SAVE] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Configurado")).toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /Reemplazar credencial/ })).toBeInTheDocument();
  },
};

/** El RUT se valida en el FE (dígito verificador): no mandamos basura al backend. */
export const RutInvalido: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument());
    // 11.111.111 tiene DV 1 → "-2" es inválido a propósito.
    await userEvent.type(canvas.getByLabelText(/RUT del representante legal/i), "11111111-2");
    await expect(canvas.getByText(/dígito verificador/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Conectar Previred/ })).toBeDisabled();
  },
};

/** RUT válido + clave → habilita conectar y guarda (la clave se limpia, el RUT queda). */
export const ConectaYGuarda: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument());
    await userEvent.type(canvas.getByLabelText(/RUT del representante legal/i), "12345678-5");
    await userEvent.type(canvas.getByLabelText(/Clave de Previred/i), "mi-clave");
    const btn = canvas.getByRole("button", { name: /Conectar Previred/ });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    await waitFor(() => expect(canvas.getByText(/Credencial guardada/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  },
};
