import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaProyeccion } from "./caja-proyeccion";

const meta = {
  title: "Inicio v2 / CajaProyeccion",
  component: CajaProyeccion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Caja hoy + proyectada + brecha en UNA card (antes eran 3): saldo, curva proyectada con línea de cero, y mínimas a 14/30 días + días de caja.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaProyeccion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    cajaHoy: -1_518_883,
    subtitulo: "Caja hoy · estimada",
    serie: [2_000_000, 1_100_000, 0, -1_518_883, -3_100_000, -4_500_000, -5_737_505],
    filas: [
      { label: "Mínima a 14 días", valor: "−$5.737.505", tono: "neg" },
      { label: "Mínima a 30 días", valor: "−$5.737.505", tono: "neg" },
      {
        label: "Días de caja",
        valor: "0",
        tono: "neg",
        nota: "Tu caja ya está bajo el mínimo que configuraste. Deja afuera $73.641.695 de deuda ya vencida, que la curva no pone en ningún día.",
      },
    ],
    stamp: "Caja hoy · Actualizado 08-07 20:00 · banco",
  },
};

export const Sana: Story = {
  args: {
    cajaHoy: 28_400_000,
    subtitulo: "Caja hoy · 3,2 meses de autonomía",
    serie: [12_000_000, 15_000_000, 18_000_000, 21_000_000, 24_000_000, 26_500_000, 28_400_000],
    filas: [
      { label: "Mínima a 30 días", valor: "$19.200.000", tono: "pos" },
      {
        label: "Días de caja",
        valor: "más de 30",
        tono: "pos",
        nota: "Tu caja proyectada no baja de tu mínimo en los próximos 30 días.",
      },
      { label: "Colchón objetivo", valor: "✓ cubierto", tono: "pos" },
    ],
    stamp: "Caja hoy · Actualizado hoy · banco",
  },
};

/** EL CASO QUE ESTA CARD PINTABA EN VERDE. Bajo la definición nueva de los días de caja —el primer
 *  día en que la caja proyectada cierra bajo el mínimo— un 26 no es holgura: es un cruce dentro del
 *  mes, y la pantalla lo mostraba en tono positivo con un "~" que lo hacía sonar a aproximación del
 *  ritmo de gasto. Acá va en tono de advertencia, con el día nombrado y con los $73,6M de deuda ya
 *  vencida que la cifra no contempla. Es la forma REAL medida en producción el 2026-10-04. */
export const CruzaDentroDelMes: Story = {
  name: "Cruza el mínimo el día 26",
  args: {
    cajaHoy: 6_700_000,
    subtitulo: "Caja hoy",
    serie: [9_800_000, 9_100_000, 8_400_000, 7_600_000, 7_100_000, 6_900_000, 6_700_000],
    filas: [
      { label: "Mínima a 14 días", valor: "$5.400.000", tono: "pos" },
      { label: "Mínima a 30 días", valor: "$2.100.000", tono: "pos" },
      {
        label: "Días de caja",
        valor: "26",
        tono: "warn",
        nota: "El día 26 tu caja proyectada cierra bajo tu mínimo. Deja afuera $73.641.695 de deuda ya vencida, que la curva no pone en ningún día.",
      },
    ],
    stamp: "Caja hoy · Actualizado hoy · banco",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("26")).toBeInTheDocument();
    await expect(canvas.getByText(/cierra bajo tu mínimo/i)).toBeInTheDocument();
    await expect(canvas.getByText(/\$73\.641\.695/)).toBeInTheDocument();
  },
};

export const Interaccion: Story = {
  name: "Saldo y mínimas",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("−$1.518.883")).toBeInTheDocument();
    await expect(canvas.getByText("Días de caja")).toBeInTheDocument();
  },
};

/** Banco caído / bloque `cash_today` ausente: el saldo es DESCONOCIDO. Nunca "$0" (menos en
 *  verde) — faltante ≠ 0 (§13). Las mínimas del forecast sí se muestran (esas sí llegaron). */
export const SinDatoDeSaldo: Story = {
  args: {
    cajaHoy: null,
    subtitulo: "Sin dato de saldo · conecta tu banco",
    serie: [],
    filas: [
      { label: "Mínima a 14 días", valor: "−$5.737.505", tono: "neg" },
      { label: "Días de caja", valor: "0", tono: "neg" },
    ],
    stamp: "Actualizado 08-07 20:00 · banco",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sin dato")).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(canvas.getByText(/conecta tu banco/i)).toBeInTheDocument();
  },
};
