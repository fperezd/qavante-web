import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { within, expect, userEvent, waitFor } from "storybook/test";
import { PreviredCredentialCard } from "./previred-credential-card";

/* Credencial de Previred (ADR-0070). `GET/POST /api/admin/sources/previred/credential`.
   El backend declara `expected_keys = (username, password)`: username = RUT del REPRESENTANTE
   LEGAL, password = su clave Previred.

   Los handlers MSW se declaran POR STORY (no en `meta`): así cada estado fija su propio GET sin
   depender de cómo Storybook resuelve el override de un array de handlers heredado. */

const META_CRED = {
  source_code: "previred",
  provider: "previred",
  purpose: "login",
  human_label: "Previred (RUT del Representante Legal + clave)",
  expected_keys: ["username", "password"],
};

const getCredential = (isActive: boolean) =>
  http.get("*/api/admin/sources/previred/credential", () =>
    HttpResponse.json(
      { ...META_CRED, is_active: isActive, ...(isActive ? { updated_at: "2026-07-16T12:00:00Z" } : {}) },
      { status: 200 },
    ),
  );
const SAVE = http.post("*/api/admin/sources/previred/credential", () =>
  HttpResponse.json({ status: "ok" }, { status: 201 }),
);

const sinConfigurar = { msw: { handlers: [getCredential(false), SAVE] } };
const configurada = { msw: { handlers: [getCredential(true), SAVE] } };

const meta = {
  title: "Capa 2 / Credenciales / PreviredCredentialCard",
  component: PreviredCredentialCard,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 560 }}><Story /></div>],
} satisfies Meta<typeof PreviredCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinConfigurar: Story = {
  parameters: sinConfigurar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument(), { timeout: 8000 });
    await expect(canvas.getByText(/representante legal \(no el de la empresa\)/i)).toBeInTheDocument();
    // Sin datos válidos, no se puede conectar.
    await expect(canvas.getByRole("button", { name: /Conectar Previred/ })).toBeDisabled();
  },
};

export const YaConfigurada: Story = {
  parameters: configurada,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Configurado")).toBeInTheDocument(), { timeout: 8000 });
    await expect(canvas.getByRole("button", { name: /Reemplazar credencial/ })).toBeInTheDocument();
  },
};

/** El RUT se valida en el FE (dígito verificador): no mandamos basura al backend. */
export const RutInvalido: Story = {
  parameters: sinConfigurar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument(), { timeout: 8000 });
    // 11.111.111 tiene DV 1 → "-2" es inválido a propósito.
    await userEvent.type(canvas.getByLabelText(/RUT del representante legal/i), "11111111-2");
    await waitFor(() => expect(canvas.getByText(/dígito verificador/i)).toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /Conectar Previred/ })).toBeDisabled();
  },
};

/** RUT válido + clave → habilita conectar y guarda (la clave se limpia, el RUT queda). */
export const ConectaYGuarda: Story = {
  parameters: sinConfigurar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No configurado")).toBeInTheDocument(), { timeout: 8000 });
    await userEvent.type(canvas.getByLabelText(/RUT del representante legal/i), "12345678-5");
    await userEvent.type(canvas.getByLabelText(/Clave de Previred/i), "mi-clave");
    const btn = canvas.getByRole("button", { name: /Conectar Previred/ });
    await waitFor(() => expect(btn).toBeEnabled(), { timeout: 8000 });
    await userEvent.click(btn);
    await waitFor(() => expect(canvas.getByText(/Credencial guardada/i)).toBeInTheDocument(), {
      timeout: 8000,
    });
  },
};
