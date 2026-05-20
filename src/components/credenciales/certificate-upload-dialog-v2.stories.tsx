import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { CertificateUploadDialogV2 } from "./certificate-upload-dialog-v2";

const meta = {
  title: "Capa 2 / Credenciales / CertificateUploadDialogV2",
  component: CertificateUploadDialogV2,
  parameters: {
    docs: {
      description: {
        component:
          "Upload de certificado digital .pfx — Opción A (multi-holder, `POST /api/admin/certificates`). Acepta password, password_hint opcional y rut_holder opcional (si se omite, el backend intenta extraerlo del subject del certificado).",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CertificateUploadDialogV2>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
