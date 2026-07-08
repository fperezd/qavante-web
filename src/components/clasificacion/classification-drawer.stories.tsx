import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ClassificationDrawer } from "./classification-drawer";
import {
  CANONICAL_CATEGORIES_FIXTURE,
  DIMENSION_VALUES_FIXTURE,
  MANAGEMENT_ACCOUNTS_FIXTURE,
} from "./fixtures";

const meta = {
  title: "Capa 2 / Clasificación / ClassificationDrawer",
  component: ClassificationDrawer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Shell del drawer de clasificación (addendum §17.2). Presentacional puro: compone los 3 selectores, mantiene solo estado de formulario local y emite el payload por callbacks. Resumen read-only (no edita glosa/fecha/monto — §17.4). El request real lo arma la integración.",
      },
    },
  },
} satisfies Meta<typeof ClassificationDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

const movement = {
  date: "14-05-2026",
  description: "PAGO PROVEEDOR MICROSOFT CHILE",
  bankLabel: "Banco BICE ····1234",
  amountFormatted: "$1.190.000",
};

const dimensions = [
  {
    id: "proyecto",
    name: "Proyecto",
    allowsMultiple: false,
    values: DIMENSION_VALUES_FIXTURE,
  },
];

function Interactive() {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="min-h-[600px] bg-neutral-light/20 p-4">
      <button
        type="button"
        className="rounded-md bg-brand-primary px-3 py-2 text-sm text-surface"
        onClick={() => setOpen(true)}
      >
        Abrir drawer
      </button>
      <ClassificationDrawer
        open={open}
        onClose={() => setOpen(false)}
        movement={movement}
        canonicalCategories={CANONICAL_CATEGORIES_FIXTURE}
        managementAccounts={MANAGEMENT_ACCOUNTS_FIXTURE}
        dimensions={dimensions}
        onSave={() => setOpen(false)}
        onSaveAndCreateRule={() => setOpen(false)}
        onMarkForReview={() => setOpen(false)}
      />
    </div>
  );
}

const baseArgs = {
  open: true,
  onClose: () => {},
  movement,
  canonicalCategories: CANONICAL_CATEGORIES_FIXTURE,
  managementAccounts: MANAGEMENT_ACCOUNTS_FIXTURE,
  dimensions,
  onSave: () => {},
  onSaveAndCreateRule: () => {},
  onMarkForReview: () => {},
};

export const Default: Story = {
  args: baseArgs,
  render: () => <Interactive />,
};

export const Saving: Story = {
  args: { ...baseArgs, saving: true },
};

export const WithoutDimensions: Story = {
  args: { ...baseArgs, dimensions: [] },
};

/* Seguimiento del ciclo de vida (primitivo Timeline) — los pasos los arma el
   contenedor con datos reales; acá se muestran los de "por clasificar". */
export const ConSeguimiento: Story = {
  name: "Con seguimiento (ciclo de vida)",
  args: {
    ...baseArgs,
    lifecycle: [
      {
        status: "done",
        title: "Detectado en tu banco",
        children: "14-05-2026 · Cuenta ····1234",
      },
      {
        status: "current",
        title: "Por clasificar",
        children: "Qavante no lo clasificó con confianza. Elige la categoría de gestión abajo.",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Seguimiento")).toBeVisible();
    await expect(canvas.getByText("Detectado en tu banco")).toBeVisible();
    // Texto único del paso "en curso" (evita colisión con la categoría homónima).
    await expect(canvas.getByText(/no lo clasificó con confianza/i)).toBeVisible();
  },
};

/* #4: el error de guardado se renderiza DENTRO del drawer (arriba del footer),
   nunca en el flujo de la página (quedaría invisible bajo el overlay z-50). */
export const WithError: Story = {
  args: {
    ...baseArgs,
    error: (
      <p role="alert" className="text-sm text-danger-500">
        No pudimos guardar la clasificación. Intenta nuevamente.
      </p>
    ),
  },
};
