import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { CertificateListView } from "./certificate-list-view";
import type { CertificatesListResponse } from "@/lib/api/credentials";

/* CertificateListView — container de la sección de certificados digitales
   (.pfx) en `/administracion/credenciales`. Usa `useCertificatesList` para
   loading/error/empty/lista; subir/eliminar son por interacción. Handlers
   MSW para `GET /api/admin/certificates` (respuesta `{ certificates, count }`). */

type Cert = NonNullable<CertificatesListResponse["certificates"]>[number];

const CERTS: Cert[] = [
  {
    id: "cert-1",
    rut_holder: "76.123.456-7",
    holder_name: "Qavante SpA",
    status: "active",
    issued_at: "2026-01-15T00:00:00Z",
    expires_at: "2027-01-15T00:00:00Z",
    uploaded_at: "2026-01-15T12:00:00Z",
    payload_size_bytes: 4096,
    password_hint: "la de siempre",
  },
  {
    id: "cert-2",
    rut_holder: "12.345.678-9",
    holder_name: "Fernando Pérez",
    status: "active",
    issued_at: "2025-06-01T00:00:00Z",
    expires_at: "2026-06-01T00:00:00Z",
    uploaded_at: "2025-06-01T12:00:00Z",
    payload_size_bytes: 3850,
    password_hint: null,
  },
];

const PATH = "*/api/admin/certificates";

const OK = http.get(PATH, () =>
  HttpResponse.json({ certificates: CERTS, count: CERTS.length }, { status: 200 }),
);
const EMPTY = http.get(PATH, () =>
  HttpResponse.json({ certificates: [], count: 0 }, { status: 200 }),
);
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ certificates: CERTS, count: CERTS.length }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar los certificados." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Credenciales / CertificateListView",
  component: CertificateListView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Lista de certificados digitales (.pfx) por titular. El container resuelve loading/error/empty/lista desde `GET /api/admin/certificates`. Subir y eliminar son por interacción (dialogs). La clave del .pfx no se almacena.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof CertificateListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lista: Story = {
  name: "Lista (2 titulares)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin certificados)",
  parameters: { msw: { handlers: [EMPTY] } },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  parameters: { msw: { handlers: [LOADING] } },
};

export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR] } },
};
