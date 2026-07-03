import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { UseQueryResult } from "@tanstack/react-query";
import { DotacionView } from "./dotacion-view";
import type { EmployeesListResponse } from "@/lib/api/buk";

/* DotacionView — lista de empleados del BUK (Remuneraciones). Presentacional:
   recibe `query` como prop. Se storyea con un fake-UseQueryResult (sin MSW). */

type EmpQuery = UseQueryResult<EmployeesListResponse, unknown>;

function buildQuery(opts: Partial<EmpQuery>): EmpQuery {
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
  } as EmpQuery;
}

const SUCCESS: EmployeesListResponse = {
  status: "ok",
  count: 5,
  employees: [
    { id: 1, full_name: "Ana Pérez Soto", rut: "12.345.678-9", email: "ana@empresa.cl", role: "Analista de Finanzas", gender: "F", status: "activo" },
    { id: 2, full_name: "Benjamín Rojas Díaz", rut: "9.876.543-2", email: "benjamin@empresa.cl", role: "Jefe de Operaciones", gender: "M", status: "activo" },
    { id: 3, full_name: "Carla Muñoz Vera", rut: "15.111.222-3", email: "carla@empresa.cl", role: "Contadora", gender: "F", status: "activo" },
    { id: 4, full_name: "Diego Fuentes Lara", rut: "17.888.999-0", email: "diego@empresa.cl", role: "Desarrollador", gender: "M", status: "activo" },
    { id: 5, full_name: "Elena Torres Gil", rut: "11.222.333-4", email: "elena@empresa.cl", role: "Vendedora", gender: "F", status: "inactivo" },
  ],
} as EmployeesListResponse;

const EMPTY: EmployeesListResponse = { status: "ok", count: 0, employees: [] } as EmployeesListResponse;

const meta = {
  title: "Capa 2 / Remuneraciones / DotacionView",
  component: DotacionView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Lista de empleados (dotación) del conector BUK. Presentacional: recibe `query` por prop. Filtro por texto client-side; clic en fila abre el detalle (onSelect). Gated `remuneraciones`.",
      },
    },
  },
  args: { onSelect: fn() },
} satisfies Meta<typeof DotacionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConEmpleados: Story = {
  name: "Con empleados",
  args: { query: buildQuery({ data: SUCCESS }) },
};

export const Vacio: Story = {
  name: "Sin empleados",
  args: { query: buildQuery({ data: EMPTY }) },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  args: {
    query: buildQuery({ isLoading: true, isFetching: true, isPending: true, isSuccess: false, status: "pending" }),
  },
};

export const ConError: Story = {
  name: "Error (BUK no responde / 401)",
  args: {
    query: buildQuery({
      isError: true,
      isSuccess: false,
      status: "error",
      error: new globalThis.Error("No pudimos conectar con Remuneraciones (BUK)."),
    }),
  },
};
