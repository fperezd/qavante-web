import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
