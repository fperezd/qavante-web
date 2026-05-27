import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Users, AlertCircle, FileText } from "lucide-react";
import { QavanteEmpty } from "./qavante-empty";
import { QavanteButton } from "./qavante-button";

const meta = {
  title: "Capa 1 / QavanteEmpty",
  component: QavanteEmpty,
  parameters: {
    docs: {
      description: {
        component:
          "Empty state canónico — usado en listados vacíos, errores recuperables, módulos en construcción. Soporta `icon` (Lucide), `title`, `description`, `cta`. Anexo B.2 + Anexo F (voice & tone). El default icon es `Inbox`.",
      },
    },
  },
  args: {
    title: "Todavía no hay usuarios",
    description: "Invita a tu primer colaborador para empezar a gestionar tu empresa con Qavante.",
  },
} satisfies Meta<typeof QavanteEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCTA: Story = {
  args: {
    icon: Users,
    cta: <QavanteButton variant="primary">Invitar usuario</QavanteButton>,
  },
};

export const ErrorState: Story = {
  args: {
    icon: AlertCircle,
    title: "No pudimos cargar las credenciales",
    description: "Prueba refrescar la página. Si persiste, contacta a soporte.",
  },
};

export const ModuleInConstruction: Story = {
  args: {
    icon: FileText,
    title: "Inicio Ejecutivo — construcción en Sprint C8",
    description:
      "Acá vas a ver una frase ejecutiva, tu Pulso Empresa, alertas prioritarias y próximas acciones.",
    cta: (
      <QavanteButton size="sm" variant="ghost">
        Ver roadmap
      </QavanteButton>
    ),
  },
};
