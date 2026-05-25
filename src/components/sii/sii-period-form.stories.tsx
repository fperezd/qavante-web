import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SiiPeriodForm } from "./sii-period-form";

/* Form reusable para consultar SII por período (Sprint C1 — RCV/BHE).
   PRESENTACIONAL PURO: no usa hooks de query; emite `periodo` normalizado
   a YYYY-MM por callback. El estado `loading` lo controla el caller. */

const meta = {
  title: "Capa 2 / SII / SiiPeriodForm",
  component: SiiPeriodForm,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Form reusable para consultar el SII por período (usado por RCV Compras / RCV Ventas / BHE Recibidas). Validación zod (YYYY-MM, YYYYMM o 'Abril 2026'). El default es el mes pasado: los datos del mes vigente típicamente no están completos en el SII hasta mediados del siguiente.",
      },
    },
  },
  args: {
    onSubmit: fn(),
    now: new Date("2026-05-24T12:00:00Z"),
  },
} satisfies Meta<typeof SiiPeriodForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Estado por defecto — el período arranca con el mes pasado (abril 2026 si la fecha actual es 24-05-2026).",
      },
    },
  },
};

export const ConHint: Story = {
  args: {
    hint: "Los honorarios del mes vigente típicamente no están completos hasta mediados del siguiente.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Con hint contextual debajo del input. Usado en la vista BHE Recibidas para explicar por qué el default es el mes pasado.",
      },
    },
  },
};

export const Loading: Story = {
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          "Estado loading externo — el botón muestra spinner. El caller pasa `loading={query.isFetching}` cuando el query corre.",
      },
    },
  },
};

export const PeriodoExplicito: Story = {
  args: { defaultValue: "2026-03" },
  parameters: {
    docs: {
      description: {
        story:
          "Override del período inicial. Útil cuando el caller arma deep-links o restaura el último período consultado.",
      },
    },
  },
};
