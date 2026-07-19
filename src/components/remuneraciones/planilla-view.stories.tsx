import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, within, expect } from "storybook/test";
import type { UseQueryResult } from "@tanstack/react-query";
import { PlanillaView } from "./planilla-view";
import type { EmployeePayroll } from "./payroll-detalle";
import type { PayrollResponse } from "@/lib/api/buk";

/* PlanillaView — totales agregados de remuneraciones del período (BUK).
   Presentacional: recibe `query` por prop. Fake-UseQueryResult (sin MSW). */

type PayQuery = UseQueryResult<PayrollResponse, unknown>;

function buildQuery(opts: Partial<PayQuery>): PayQuery {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    isPending: false,
    status: "success",
    fetchStatus: "idle",
    ...opts,
  } as PayQuery;
}

const SUCCESS: PayrollResponse = {
  status: "ok",
  period: "2026-03",
  totales: {
    total_haberes: 18450000,
    total_descuentos: 4120000,
    total_liquido: 14330000,
    total_imponible: 16800000,
    empleados_contados: 12,
  },
} as PayrollResponse;

/* Con detalle por empleado (contrato FE-first `payroll.detalle`) para conciliación
   bancaria. La suma del detalle cuadra con el total agregado. */
const CON_DETALLE = {
  status: "ok",
  period: "2026-03",
  totales: {
    total_haberes: 3800000,
    total_descuentos: 900000,
    total_liquido: 2900000,
    total_imponible: 3400000,
    total_impuesto: 145000,
    total_previred: 720000,
    empleados_contados: 3,
  },
} as unknown as PayrollResponse;

/* El detalle por empleado lo resuelve el page (desde /api/buk/payroll/detail) y lo pasa
   como prop `detalle` — no viaja dentro de `query.data`. Trae haberes + líquido por persona. */
const DETALLE_EMPLEADOS: EmployeePayroll[] = [
  { id: "1", nombre: "Ana Pérez Soto", rut: "12.345.678-9", haberes: 1580000, liquido: 1200000 },
  { id: "2", nombre: "Benjamín Rojas Díaz", rut: "9.876.543-2", haberes: 1320000, liquido: 1000000 },
  { id: "3", nombre: "Carla Muñoz Vera", rut: "15.111.222-3", haberes: 900000, liquido: 700000 },
];

const meta = {
  title: "Capa 2 / Remuneraciones / PlanillaView",
  component: PlanillaView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Totales de planilla del período (BUK) + detalle por empleado (líquido) para conciliación bancaria. El detalle es contrato FE-first: si el backend no lo expone, se muestra solo el agregado. Recibe `query` por prop. Gated `remuneraciones`.",
      },
    },
  },
  args: { onPeriodChange: fn() },
} satisfies Meta<typeof PlanillaView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  name: "Inicial (sin período)",
  args: {
    period: null,
    query: buildQuery({ isSuccess: false, status: "pending", isPending: true }),
  },
};

export const ConTotales: Story = {
  name: "Con totales (sin detalle por empleado)",
  args: { period: "2026-03", query: buildQuery({ data: SUCCESS }) },
};

export const ConDetallePorEmpleado: Story = {
  name: "Con detalle por empleado (conciliación)",
  args: {
    period: "2026-03",
    query: buildQuery({ data: CON_DETALLE }),
    detalle: DETALLE_EMPLEADOS,
    // El impuesto de remuneraciones (IUSC) llega del F29 (código 48), no del payroll.
    impuestoF29: 415934,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El total haberes (bruto) del período y la columna de haberes por empleado se muestran.
    await expect(canvas.getByText("Total haberes")).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: "Haberes" })).toBeInTheDocument();
    // El impuesto F29 (prop, desde /sii/f29/impuesto) gana sobre el total del payroll.
    await expect(canvas.getByText("$415.934")).toBeInTheDocument();
  },
};

/* No-owner: el detalle vino 403 → mensaje honesto "solo para el dueño"
   (distinto de "no hay dato"). Desde CC-API #542 el owner ya no cae acá. */
export const DetalleSoloDueno: Story = {
  name: "Detalle solo para el dueño (no-owner, 403)",
  args: { period: "2026-03", query: buildQuery({ data: SUCCESS }), detalleForbidden: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/visible solo para el/i)).toBeInTheDocument();
    await expect(canvas.getByText(/dueño/i)).toBeInTheDocument();
  },
};

export const SinPlanilla: Story = {
  name: "Período sin planilla",
  args: {
    period: "2026-03",
    query: buildQuery({ data: { status: "ok", period: "2026-03" } as PayrollResponse }),
  },
};

export const Cargando: Story = {
  args: {
    period: "2026-03",
    query: buildQuery({
      isLoading: true,
      isFetching: true,
      isPending: true,
      isSuccess: false,
      status: "pending",
    }),
  },
};

export const ConError: Story = {
  name: "Error (BUK no responde / 401)",
  args: {
    period: "2026-03",
    query: buildQuery({
      isError: true,
      isSuccess: false,
      status: "error",
      error: new globalThis.Error("No pudimos consultar la planilla en BUK."),
    }),
  },
};
