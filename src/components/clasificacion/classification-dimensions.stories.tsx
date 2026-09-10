import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, within } from "storybook/test";
import {
  useClassificationDimensions,
  type ManagementDimension,
  type ManagementDimensionValue,
} from "@/lib/api/management";
import { concordar } from "@/lib/formatters/count";

/* V12 §12C · arnés del hook compartido por Bandeja/Clasificación, Banco V03 y detalle de cuenta.
 * Prueba el límite de datos una sola vez: los tres consumidores reciben exactamente esta salida y
 * no tienen que repetir el criterio de cuándo una vista de gestión ya es elegible. */

const DIMENSIONS_PATH = "*/api/management/dimensions";
const VALUES_PATH = "*/api/management/dimensions/:dimensionId/values";

function dimension(id: string, name: string): ManagementDimension {
  return {
    id,
    code: id,
    name,
    description: null,
    data_type: "text",
    is_system: false,
    is_required: false,
    is_visible: true,
    allows_hierarchy: false,
    allows_multiple_values: false,
    sort_order: 0,
    active: true,
    metadata: {},
    created_at: "2026-09-09T12:00:00Z",
    updated_at: "2026-09-09T12:00:00Z",
  };
}

function value(dimensionId: string, id: string, active: boolean): ManagementDimensionValue {
  return {
    id,
    dimension_id: dimensionId,
    parent_id: null,
    code: id,
    name: id,
    description: null,
    path: null,
    sort_order: 0,
    active,
    metadata: {},
    created_at: "2026-09-09T12:00:00Z",
    updated_at: "2026-09-09T12:00:00Z",
  };
}

function dimensionsHandler(items: ManagementDimension[]) {
  return http.get(DIMENSIONS_PATH, () => HttpResponse.json({ items }));
}

function valuesHandler(
  response: (
    dimensionId: string,
  ) => ManagementDimensionValue[] | Promise<ManagementDimensionValue[]>,
) {
  return http.get(VALUES_PATH, async ({ params }) =>
    HttpResponse.json({ items: await response(String(params.dimensionId)) }),
  );
}

function ClassificationDimensionsHarness({ enabled = true }: { enabled?: boolean }) {
  const result = useClassificationDimensions(enabled);
  const state = result.isError ? "Error" : result.isLoading ? "Cargando vistas…" : "Listas";
  const unidad = concordar(result.data.length, "vista elegible", "vistas elegibles");
  return (
    <section aria-label="Vistas disponibles">
      <p>{state}</p>
      <p>
        {result.data.length} {unidad}
      </p>
      <ul>
        {result.data.map(({ dimension: item }) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </section>
  );
}

const meta = {
  title: "Rediseño F2 / V12 Administración / Vistas elegibles",
  component: ClassificationDimensionsHarness,
  parameters: { layout: "padded" },
  args: { enabled: true },
} satisfies Meta<typeof ClassificationDimensionsHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

const proyecto = dimension("proyecto", "Proyecto");

export const SinValores: Story = {
  parameters: {
    msw: { handlers: [dimensionsHandler([proyecto]), valuesHandler(() => [])] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Listas")).toBeInTheDocument();
    await expect(canvas.getByText("0 vistas elegibles")).toBeInTheDocument();
    await expect(canvas.queryByText("Proyecto")).not.toBeInTheDocument();
  },
};

export const SoloValoresInactivos: Story = {
  parameters: {
    msw: {
      handlers: [
        dimensionsHandler([proyecto]),
        valuesHandler(() => [value("proyecto", "Cerrado", false)]),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Listas")).toBeInTheDocument();
    await expect(canvas.getByText("0 vistas elegibles")).toBeInTheDocument();
    await expect(canvas.queryByText("Proyecto")).not.toBeInTheDocument();
  },
};

export const ConValorActivo: Story = {
  parameters: {
    msw: {
      handlers: [
        dimensionsHandler([proyecto]),
        valuesHandler(() => [
          value("proyecto", "Archivado", false),
          value("proyecto", "Norte", true),
        ]),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Listas")).toBeInTheDocument();
    await expect(canvas.getByText("1 vista elegible")).toBeInTheDocument();
    await expect(canvas.getByText("Proyecto")).toBeInTheDocument();
  },
};

export const EsperaTodasLasConsultas: Story = {
  parameters: {
    msw: {
      handlers: [
        dimensionsHandler([proyecto, dimension("obra", "Obra")]),
        valuesHandler(async (dimensionId) => {
          if (dimensionId === "obra") await delay("infinite");
          return [value(dimensionId, `${dimensionId}-uno`, true)];
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Cargando vistas…")).toBeInTheDocument();
    await expect(canvas.getByText("0 vistas elegibles")).toBeInTheDocument();
    await expect(canvas.queryByText("Proyecto")).not.toBeInTheDocument();
  },
};

export const ConservaElError: Story = {
  parameters: {
    msw: {
      handlers: [
        dimensionsHandler([proyecto]),
        http.get(VALUES_PATH, () =>
          HttpResponse.json({ code: "internal_error", detail: "sin valores" }, { status: 500 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Error")).toBeInTheDocument();
    await expect(canvas.getByText("0 vistas elegibles")).toBeInTheDocument();
    await expect(canvas.queryByText("Proyecto")).not.toBeInTheDocument();
  },
};

export const DeshabilitadoNoConsulta: Story = {
  args: { enabled: false },
  parameters: {
    msw: {
      handlers: [
        http.get(DIMENSIONS_PATH, () =>
          HttpResponse.json(
            { code: "unexpected_request", detail: "no debía consultar" },
            { status: 500 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await delay(100);
    await expect(canvas.getByText("Listas")).toBeInTheDocument();
    await expect(canvas.getByText("0 vistas elegibles")).toBeInTheDocument();
    await expect(canvas.queryByText("Error")).not.toBeInTheDocument();
  },
};
