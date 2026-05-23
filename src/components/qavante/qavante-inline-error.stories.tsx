import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteInlineError } from "./qavante-inline-error";
import { ApiError } from "@/lib/api/errors";

const meta = {
  title: "Capa 1 / QavanteInlineError",
  component: QavanteInlineError,
  parameters: {
    docs: {
      description: {
        component:
          "Alerta inline para estados de error de queries (Anexo C.3). Mapea `ApiError` → copy del mapeo de errores; cualquier otro error cae al fallback genérico con `what`. `role='alert'` para que lectores anuncien el cambio automáticamente.",
      },
    },
    layout: "padded",
  },
} satisfies Meta<typeof QavanteInlineError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApiErrorConocido: Story = {
  args: {
    error: new ApiError("Forbidden", 403, "forbidden"),
    what: "los ajustes de moneda",
  },
  parameters: {
    docs: {
      description: {
        story:
          "ApiError clasificado (ej. 403) → muestra el copy del Anexo C.3 (en este caso, mensaje contextual de permisos). El `what` queda como contexto interno para fallbacks.",
      },
    },
  },
};

export const ErrorGenerico: Story = {
  args: {
    error: new Error("Network timeout"),
    what: "las plantillas",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Error genérico (no ApiError) → cae al fallback 'No pudimos cargar {what}.' — copy seguro y entendible para usuarios PYME.",
      },
    },
  },
};

export const ErrorEnAccion: Story = {
  args: {
    error: new Error("500 Internal Server Error"),
    what: "al guardar la clasificación",
  },
  parameters: {
    docs: {
      description: {
        story:
          "El `what` también funciona para describir la acción que falló (no solo qué se intentaba cargar). Útil para mutations: 'No pudimos cargar al guardar la clasificación.' suena raro, idealmente migrar copys a frases del tipo 'al guardar…' / 'al editar…'.",
      },
    },
  },
};
