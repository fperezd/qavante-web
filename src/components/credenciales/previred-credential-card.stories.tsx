import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { PreviredCredentialCard } from "./previred-credential-card";

/* Credencial de Previred (ADR-0070). `GET/POST /api/admin/sources/previred/credential`.
   El backend declara `expected_keys = (username, password)`: username = RUT del REPRESENTANTE
   LEGAL, password = su clave Previred.

   Stories VISUALES (sin `play`), como el resto de las tarjetas de credenciales: es una vista
   contenedor (llama hooks) y el runner de Storybook no corre MSW — los handlers de acá sirven
   para revisar los estados en `npm run storybook`, no para aserciones automáticas (ADR-0018:
   la lógica testeable vive en módulos puros; el RUT se valida en `lib/validators/rut`, ya
   cubierto por unit). */

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

const meta = {
  title: "Capa 2 / Credenciales / PreviredCredentialCard",
  component: PreviredCredentialCard,
  parameters: { layout: "centered", msw: { handlers: [getCredential(false), SAVE] } },
  decorators: [(Story) => <div style={{ width: 560 }}><Story /></div>],
} satisfies Meta<typeof PreviredCredentialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin configurar: pide RUT del representante legal + clave. */
export const SinConfigurar: Story = { name: "Sin configurar" };

/** Ya configurada: badge en verde y el botón pasa a "Reemplazar credencial". */
export const YaConfigurada: Story = {
  name: "Ya configurada",
  parameters: { msw: { handlers: [getCredential(true), SAVE] } },
};
