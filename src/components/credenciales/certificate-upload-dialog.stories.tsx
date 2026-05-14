import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { CertificateUploadDialog } from "./certificate-upload-dialog";

const meta = {
  title: "Capa 2 / Credenciales / CertificateUploadDialog",
  component: CertificateUploadDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Dialog de upload del certificado digital PKCS#12. Valida extensión `.pfx`/`.p12` y peso ≤ 100KB en el cliente. Backend valida la integridad real del PKCS#12 + match RUT/subject — devuelve `invalid_pkcs12` si falla.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CertificateUploadDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewUpload: Story = {
  args: { isReplacement: false },
  parameters: {
    docs: {
      description: {
        story: "Primera carga — copy 'Cargar certificado'.",
      },
    },
  },
};

export const Replacement: Story = {
  args: { isReplacement: true },
  parameters: {
    docs: {
      description: {
        story:
          "Reemplazo (renovación) — copy 'Reemplazar' + warning de que el viejo se va a borrar.",
      },
    },
  },
};
