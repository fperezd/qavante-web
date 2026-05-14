import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CertificateCard } from "./certificate-card";

/* Helper para generar `expires_at` relativo a hoy. Las stories de banners
   tienen que producirse desde "ahora" para que `getBanner` los clasifique
   correctamente (warn ≤60d, urgent ≤30d, expired ≤0d). */
function fromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const meta = {
  title: "Capa 2 / Credenciales / CertificateCard",
  component: CertificateCard,
  parameters: {
    docs: {
      description: {
        component:
          "Card de certificado digital PKCS#12. Muestra banners de vencimiento según `getBanner()` (ok / warn 60d / urgent 30d / expired). Tests unitarios en `expiration-banner.test.ts` cubren los thresholds.",
      },
    },
    layout: "padded",
  },
} satisfies Meta<typeof CertificateCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConfigured: Story = {
  args: {
    certificate: { configured: false },
  },
};

export const ValidOk: Story = {
  args: {
    certificate: {
      configured: true,
      subject_rut: "76.123.456-7",
      expires_at: fromNow(180),
      uploaded_at: "2026-04-01T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Certificado vigente, vence en 180 días — sin banner.",
      },
    },
  },
};

export const WarnExpiring60Days: Story = {
  args: {
    certificate: {
      configured: true,
      subject_rut: "76.123.456-7",
      expires_at: fromNow(45),
      uploaded_at: "2025-11-01T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Banner de warning amarillo: vence en ≤60 días pero >30. Tono `warn`.",
      },
    },
  },
};

export const UrgentExpiring30Days: Story = {
  args: {
    certificate: {
      configured: true,
      subject_rut: "76.123.456-7",
      expires_at: fromNow(10),
      uploaded_at: "2025-08-01T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Banner de urgencia rojo: vence en ≤30 días. Tono `urgent`.",
      },
    },
  },
};

export const Expired: Story = {
  args: {
    certificate: {
      configured: true,
      subject_rut: "76.123.456-7",
      expires_at: fromNow(-5),
      uploaded_at: "2024-08-01T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Certificado expirado hace 5 días. Banner rojo bold con CTA implícito a Reemplazar. Tono `expired`.",
      },
    },
  },
};
