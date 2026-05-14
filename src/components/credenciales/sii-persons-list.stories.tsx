import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SiiPersonsList } from "./sii-persons-list";
import type { SiiPersonStatus } from "@/lib/api/credentials";

const CONTADORA: SiiPersonStatus = {
  rut: "12.345.678-9",
  name: "Marta Soto (contadora)",
  configured: true,
  last_rotated_at: "2026-04-15T10:00:00Z",
};
const SIN_NOMBRE: SiiPersonStatus = {
  rut: "9.876.543-2",
  name: null,
  configured: true,
  last_rotated_at: null,
};

const SEED_PERSONS: SiiPersonStatus[] = [CONTADORA, SIN_NOMBRE];

const meta = {
  title: "Capa 2 / Credenciales / SiiPersonsList",
  component: SiiPersonsList,
  parameters: {
    docs: {
      description: {
        component:
          "Lista de personas autorizadas (representantes legales, contadores externos) cuyas credenciales SII puede usar Qavante. Estado vacío usa `QavanteEmpty`; estado con items muestra divider list con badge + acciones.",
      },
    },
    layout: "padded",
  },
} satisfies Meta<typeof SiiPersonsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { persons: [] },
};

export const WithPersons: Story = {
  args: { persons: SEED_PERSONS },
};

export const SinglePerson: Story = {
  args: { persons: [CONTADORA] },
};

export const PersonWithoutName: Story = {
  args: { persons: [SIN_NOMBRE] },
  parameters: {
    docs: {
      description: {
        story:
          "Si la persona no tiene nombre, se muestra cursiva 'Sin nombre' como fallback. El RUT siempre se ve.",
      },
    },
  },
};
