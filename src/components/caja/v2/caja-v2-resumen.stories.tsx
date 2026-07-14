import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { CajaV2Resumen, type CajaMovible } from "./caja-v2-resumen";
import { CajaHero } from "./caja-hero";
import { SaldoPorBanco } from "./saldo-por-banco";
import { CajaCurva } from "./caja-curva";
import type { SaldoPunto } from "./caja-curva-model";

/* Pantalla "Resumen" del Caja v2 ensamblada: hero + saldo por banco + flujo (baranda) +
   la curva (fija) + cajas movibles abajo. Datos mock. */

const meta = {
  title: "Propuestas / Caja / Pantalla completa",
  component: CajaV2Resumen,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1120px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaV2Resumen>;

export default meta;
type Story = StoryObj<typeof meta>;

const SERIE: SaldoPunto[] = [
  { label: "hoy", saldo: 18_400_000 },
  { label: "20-jul", saldo: 12_100_000 },
  { label: "27-jul", saldo: 9_800_000 },
  { label: "03-ago", saldo: 6_200_000 },
  { label: "10-ago", saldo: 7_500_000 },
  { label: "17-ago", saldo: 3_100_000 },
  { label: "24-ago", saldo: 5_400_000 },
  { label: "31-ago", saldo: 6_800_000 },
  { label: "07-sep", saldo: 5_900_000 },
];

const flujo = (
  <div className="p-5">
    <dl className="flex flex-col text-[13px]">
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <dt className="text-neutral-mid">Entra (8 sem.)</dt>
        <dd className="font-bold tabular-nums text-success-700">$42.300.000</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">Sale (8 sem.)</dt>
        <dd className="font-bold tabular-nums text-danger-500">−$54.800.000</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">Tu caja mínima</dt>
        <dd className="font-bold tabular-nums text-neutral-dark">$4.000.000</dd>
      </div>
    </dl>
  </div>
);

const curva = (
  <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <h2 className="text-sm font-bold text-neutral-dark">Saldo proyectado</h2>
    </div>
    <div className="px-3 py-3">
      <CajaCurva
        serie={SERIE}
        minimo={4_000_000}
        eventos={[
          { indice: 1, label: "Sueldos" },
          { indice: 3, label: "IVA / F29" },
          { indice: 5, label: "Bajo el mínimo", tono: "crit" },
        ]}
      />
    </div>
    <p className="mx-4 mb-4 rounded-lg border border-danger-500/30 bg-danger-500/[.06] px-3 py-2 text-[13px] text-neutral-dark">
      La semana del <b>17-ago</b> la caja toca su punto más bajo (<b>$3.100.000</b>), bajo tu mínimo de $4.000.000.
    </p>
  </div>
);

const cardTabla = (
  <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="border-b border-border px-4 py-3">
      <h2 className="text-sm font-bold text-neutral-dark">Entradas y salidas · por semana</h2>
    </div>
    <div className="px-4 py-3 text-[13px] text-neutral-mid">Tabla con saldo al cierre por semana…</div>
  </div>
);

const cardAcciones = (
  <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="border-b border-border px-4 py-3">
      <h2 className="text-sm font-bold text-neutral-dark">Qué hacer</h2>
    </div>
    <div className="px-4 py-3 text-[13px] text-neutral-mid">Cubrí la brecha del 17-ago · 8 por clasificar…</div>
  </div>
);

const MOVIBLES: CajaMovible[] = [
  { id: "flujo-semanal", label: "Entradas y salidas", node: cardTabla },
  { id: "acciones", label: "Qué hacer", node: cardAcciones },
];

export const Completa: Story = {
  args: {
    hero: (
      <CajaHero
        titulo="La empresa tiene en caja"
        saldo={18_400_000}
        runway={
          <>
            Alcanza cómodo ~4 semanas · el <b>17-ago</b> cae bajo tu mínimo ($4M).
          </>
        }
        runwayTono="warn"
        subtitulo="Saldo hoy en banco"
      />
    ),
    bancos: (
      <SaldoPorBanco
        titulo="Saldo por banco · 10 cuentas"
        bancos={[
          { banco: "BICE", saldo: 8_900_000, detalle: "3 cuentas · CLP + USD" },
          { banco: "Santander", saldo: 5_200_000, detalle: "4 cuentas" },
          { banco: "BCI", saldo: 3_100_000, detalle: "2 cuentas" },
          { banco: "Banco Estado", saldo: 1_200_000, detalle: "1 cuenta" },
        ]}
        total={18_400_000}
        totalLabel="Total · 4 bancos"
      />
    ),
    flujo,
    curva,
    movibles: MOVIBLES,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Baranda: respuesta de dueño + saldo + banco + curva.
    await expect(canvas.getByText("La empresa tiene en caja")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("BICE")).toBeInTheDocument());
    await expect(canvas.getByText("Bajo el mínimo")).toBeInTheDocument();
    // Cajas movibles presentes + reordenables (un asa por caja).
    await expect(canvas.getByText("Entradas y salidas · por semana")).toBeInTheDocument();
    await expect(canvas.getByText("Qué hacer")).toBeInTheDocument();
    expect(canvas.getAllByRole("button", { name: /hacia abajo/ })).toHaveLength(2);
  },
};
