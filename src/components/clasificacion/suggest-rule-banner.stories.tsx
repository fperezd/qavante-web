import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SuggestRuleBanner } from "./suggest-rule-banner";

const meta = {
  title: "Capa 2 / Clasificación / SuggestRuleBanner",
  component: SuggestRuleBanner,
  parameters: {
    docs: {
      description: {
        component:
          "Banner §18.7 que ofrece, dentro del drawer §17, una sugerencia de regla derivada del movimiento bancario. Read-only por contrato: el listado de reglas NO crece tras el `suggest-rule`. Persiste solo cuando el user confirma el POST desde el RuleFormDialog (que el contenedor abre con `onCreateFromSuggestion`).",
      },
    },
    layout: "padded",
  },
  args: {
    movementId: "mov-storybook-1",
    onCreateFromSuggestion: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof SuggestRuleBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "CTA inicial — el banner ofrece pedir una sugerencia. Click en 'Ver sugerencia' llama al endpoint suggest-rule (en storybook sin MSW, queda en estado de error inline pero el banner sigue funcionando).",
      },
    },
  },
};

export const SinBotonDismiss: Story = {
  args: { onDismiss: undefined },
  parameters: {
    docs: {
      description: {
        story:
          "Variante sin `onDismiss` — el botón 'No, gracias' no se renderiza. Útil si el contenedor no quiere ofrecer ocultar permanentemente el banner.",
      },
    },
  },
};
