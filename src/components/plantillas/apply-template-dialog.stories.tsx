import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import type { ApplyTemplateSummary } from "@/lib/api/industry-templates";

const SUMMARY_PENDING: ApplyTemplateSummary = {
  accounts_to_add: 12,
  dimensions_to_add: 3,
  accounts_existing: 0,
  dimensions_existing: 0,
};

const SUMMARY_PARTIAL: ApplyTemplateSummary = {
  accounts_to_add: 5,
  dimensions_to_add: 1,
  accounts_existing: 7,
  dimensions_existing: 2,
};

const SUMMARY_NOTHING_TO_DO: ApplyTemplateSummary = {
  accounts_to_add: 0,
  dimensions_to_add: 0,
  accounts_existing: 12,
  dimensions_existing: 3,
};

const meta = {
  title: "Capa 2 / Plantillas / ApplyTemplateDialog",
  component: ApplyTemplateDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Dialog confirmatorio para aplicar una plantilla de rubro (Addendum §14.1: NUNCA destructivo). Modo único expuesto: `add_missing`. `replace_visibility` queda fuera de scope. Botón primario deshabilitado hasta marcar el checkbox de confirmación.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
    templateCode: "services",
    templateName: "Servicios profesionales",
    onApplied: fn(),
  },
} satisfies Meta<typeof ApplyTemplateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodoNuevo: Story = {
  args: { summary: SUMMARY_PENDING },
  parameters: {
    docs: {
      description: {
        story:
          "Tenant nuevo: la plantilla agregará 12 cuentas + 3 vistas, nada existe todavía. La frase 'X cuentas / Y vistas ya existen' no se muestra porque ambos existing son 0.",
      },
    },
  },
};

export const Mixto: Story = {
  args: { summary: SUMMARY_PARTIAL },
  parameters: {
    docs: {
      description: {
        story:
          "Tenant con algo de gestión ya armada: la plantilla agrega 5 cuentas + 1 vista nuevas, y respeta las 7+2 existentes. Mensaje informativo aparece.",
      },
    },
  },
};

export const NadaParaAgregar: Story = {
  args: { summary: SUMMARY_NOTHING_TO_DO },
  parameters: {
    docs: {
      description: {
        story:
          "Caso edge: el tenant ya tiene todas las cuentas/vistas de la plantilla. El dialog cambia a estado 'ya tenés todo' (sin checkbox ni botón primario, solo 'Cerrar').",
      },
    },
  },
};

export const Closed: Story = {
  args: { open: false, summary: SUMMARY_PENDING },
  parameters: {
    docs: {
      description: {
        story: "Estado cerrado — el Portal no monta el popup. Story sólo para verificar no-break.",
      },
    },
  },
};
