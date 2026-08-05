import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent } from "storybook/test";
import { CajaProyeccionView } from "./caja-proyeccion-view";
import {
  causasDelPiso,
  movimientosPorSemana,
  proyeccionDeMovimientos,
} from "./caja-proyeccion-model";
import type { MovimientoCaja } from "./caja-cascada-model";

/* CajaProyeccionView — el rediseño del "Saldo proyectado" del Caja v3: medidor de días + cascada de
   próximos movimientos, ambos derivados de vencimientos. Estado honesto si no hay proyección. */

const HOY = new Date(2026, 6, 21);
const mov = (dia: number, label: string, monto: number): MovimientoCaja => ({
  fecha: new Date(2026, 6, 21 + dia),
  fechaLabel: `${21 + dia > 31 ? 21 + dia - 31 : 21 + dia}-${21 + dia > 31 ? "ago" : "jul"}`,
  label,
  monto,
});

const MOVS: MovimientoCaja[] = [
  mov(9, "Sueldos", -6_800_000),
  mov(10, "Kaufmann", 2_900_000),
  mov(20, "Proveedores", -5_100_000),
  mov(35, "Cliente B", 6_900_000),
];

const meta = {
  title: "Propuestas / Caja / CajaProyeccionView",
  component: CajaProyeccionView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 760,
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaProyeccionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConProyeccion: Story = {
  args: {
    proyeccion: proyeccionDeMovimientos(6_200_000, MOVS, HOY, null),
    minimo: null,
    movimientos: MOVS,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // medidor (gauge) + cascada (título) juntos — textos únicos (evito "Saldo hoy", que está en ambos)
    await expect(c.getByText("días de caja")).toBeInTheDocument();
    await expect(c.getByText("Próximos movimientos · de dónde salen los días")).toBeInTheDocument();
    await expect(c.getByText("Kaufmann")).toBeInTheDocument();
  },
};

export const ConSaldoStale: Story = {
  args: {
    proyeccion: proyeccionDeMovimientos(6_200_000, MOVS, HOY, null),
    minimo: null,
    movimientos: MOVS,
    ultimaSync: "18-jul",
    saldoStale: true,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Proyección sobre el saldo del banco al 18-jul/)).toBeInTheDocument();
  },
};

/* Con quiebre: la caja toca negativo → aparece el bloque "Qué te lleva al punto más bajo"
   con los mayores egresos hasta el piso (F29 + Sueldos + Proveedores). */
const BREAK_MOVS: MovimientoCaja[] = [
  mov(9, "Sueldos", -6_800_000),
  { ...mov(12, "F29", -9_200_000), tipo: "impuesto" },
  mov(20, "Proveedores", -5_100_000),
  mov(35, "Cliente B", 6_900_000),
];

const BREAK_PROY = proyeccionDeMovimientos(3_000_000, BREAK_MOVS, HOY, null);

export const ConCausasDeQuiebre: Story = {
  args: {
    proyeccion: BREAK_PROY,
    minimo: null,
    // Como en prod: la cascada recibe los movimientos SEMANALES (labels "Esta semana"/"Sem +N"),
    // no los individuales — así "F29" solo aparece en el bloque de causas (no se duplica).
    movimientos: movimientosPorSemana(BREAK_MOVS, HOY),
    causas: causasDelPiso(BREAK_MOVS, HOY, BREAK_PROY?.piso?.dia ?? 0, 3),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Qué te lleva al punto más bajo")).toBeInTheDocument();
    await expect(c.getByText("F29")).toBeInTheDocument();
  },
};

/* Caja en riesgo PERO con plata por cobrar (vencida/sin fecha) que el runway no cuenta: el caveat
   honesto evita que "sin recuperación" se lea como veredicto final. */
export const ConPorCobrar: Story = {
  args: {
    proyeccion: BREAK_PROY,
    minimo: null,
    movimientos: movimientosPorSemana(BREAK_MOVS, HOY),
    porCobrarVencido: { total: 9_400_000, n: 3 },
    conciliarHref: "/caja/conciliacion",
    cobrosPorCobrar: [
      { glosa: "TD SYNNEX CHILE LIMITADA", monto: 5_000_000, diasAtraso: 45 },
      { glosa: "COMERCIAL KAUFMANN S.A.", monto: 2_960_000, diasAtraso: null },
      { glosa: "INMOBILIARIA VISTA KENNEDY", monto: 1_440_000, diasAtraso: 12 },
    ],
    recuperacion: { pisoRecup: -3_639_436, totalRecuperado: 9_400_000, ventanaDias: 30 },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("no cuenta")).toBeInTheDocument();
    await expect(c.getByText(/su cobro no es seguro/)).toBeInTheDocument();
    // Escenario ADR-0087: muestra cuánto mejora el PISO con recuperación (adiós "sin recuperación").
    await expect(c.getByText(/Con recuperación:/)).toBeInTheDocument();
    await expect(c.getByText(/tu punto más bajo sería/)).toBeInTheDocument();
    // El "N documentos" es un toggle: al abrirlo se ve la lista uno por uno (pedido de Fernando).
    await userEvent.click(c.getByRole("button", { name: /documentos vencidos o sin fecha/ }));
    await expect(c.getByText("COMERCIAL KAUFMANN S.A.")).toBeInTheDocument();
    await expect(c.getByText("sin fecha")).toBeInTheDocument();
    // Y el CTA para conciliar (calzar con banco).
    const cta = c.getByRole("link", { name: /Conciliar cobros/ });
    await expect(cta).toHaveAttribute("href", "/caja/conciliacion");
  },
};

export const SinDato: Story = {
  args: { proyeccion: null, minimo: null, movimientos: [], ultimaSync: "18-jul" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      c.getByText("Todavía no hay suficiente movimiento para proyectar"),
    ).toBeInTheDocument();
  },
};
