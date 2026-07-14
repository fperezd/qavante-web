import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { GestionV2View, type GestionMovible } from "./gestion-v2-view";
import { ResultadoHero } from "./resultado-hero";
import { CascadaResultado } from "./cascada-resultado";
import { DriversResultado } from "./drivers-resultado";
import type { CascadaEntrada } from "./cascada-model";

/* Pantalla de Gestión v2 ensamblada: respuesta de dueño (resultado + márgenes + comparativos)
   + la cascada del resultado (baranda) + cajas movibles (qué explica el resultado + Pulso). */

const meta = {
  title: "Propuestas / Gestión / Pantalla completa",
  component: GestionV2View,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="mx-auto max-w-[1120px] p-6"><Story /></div>],
} satisfies Meta<typeof GestionV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

const PNL: CascadaEntrada[] = [
  { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 48_200_000 },
  { id: "cd", label: "Costos directos", tipo: "resta", monto: 21_400_000 },
  { id: "mb", label: "Margen bruto", tipo: "subtotal", monto: 0, pct: 55.6 },
  { id: "gl", label: "Gasto laboral", tipo: "resta", monto: 14_900_000 },
  { id: "ho", label: "Honorarios", tipo: "resta", monto: 2_300_000 },
  { id: "gr", label: "Gastos recurrentes", tipo: "resta", monto: 5_100_000 },
  { id: "res", label: "Resultado operacional", tipo: "resultado", monto: 0 },
];

const margenes = (
  <div className="p-5">
    <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">Márgenes</p>
    <dl className="mt-2 flex flex-col text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <dt className="text-neutral-mid">Margen bruto</dt>
        <dd className="font-bold tabular-nums text-neutral-dark">$26.800.000 · <span className="text-neutral-mid">55,6%</span></dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">Margen operacional</dt>
        <dd className="font-bold tabular-nums text-neutral-dark">9,3%</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">EBITDA (proxy)</dt>
        <dd className="font-bold tabular-nums text-neutral-dark">$4.500.000</dd>
      </div>
    </dl>
  </div>
);

const comparativos = (
  <div className="p-5">
    <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">Cómo viene el ritmo</p>
    <dl className="mt-2.5 flex flex-col gap-2.5 text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-neutral-mid">vs. mes anterior</dt>
        <dd className="font-bold text-success-700">+12,5%</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-neutral-mid">vs. julio 2025</dt>
        <dd className="font-bold text-success-700">+34%</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-neutral-mid">vs. promedio 3 meses</dt>
        <dd className="font-bold text-success-700">+8%</dd>
      </div>
    </dl>
  </div>
);

const pulsoCard = (
  <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="border-b border-border px-4 py-3">
      <h2 className="text-sm font-bold text-neutral-dark">Pulso del negocio</h2>
    </div>
    <div className="p-4 text-center">
      <div className="text-[46px] font-extrabold leading-none tabular-nums text-danger-500">27</div>
      <div className="mt-1.5 inline-block rounded-full bg-danger-500/10 px-2.5 py-0.5 text-[11px] font-bold text-danger-500">Débil</div>
      <p className="mt-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-left text-[12px] text-neutral-dark">
        Ganás en resultado, pero tu Pulso está débil: <b className="text-warning-700">la caja está en rojo</b>. El
        resultado es <b>devengado</b> — lo facturado, no lo cobrado.
      </p>
    </div>
  </div>
);

const MOVIBLES: GestionMovible[] = [
  {
    id: "drivers",
    label: "Qué explica el resultado",
    node: (
      <DriversResultado
        items={[
          { id: "1", direccion: "improves", concepto: "Ventas", impacto: 3_200_000, explicacion: "Las ventas subieron 8% vs. el mes pasado." },
          { id: "2", direccion: "worsens", concepto: "Sueldos", impacto: 1_100_000, explicacion: "Sumaste 1 persona al equipo este mes." },
          { id: "3", direccion: "improves", concepto: "Costo de venta", impacto: 800_000, explicacion: "Mejor margen por mix de productos." },
          { id: "4", direccion: "worsens", concepto: "Honorarios", impacto: 400_000, explicacion: "Asesoría legal puntual (una vez)." },
        ]}
      />
    ),
  },
  { id: "pulso", label: "Pulso del negocio", node: pulsoCard },
];

export const Completa: Story = {
  args: {
    hero: (
      <ResultadoHero
        titulo="El negocio ganó este mes"
        resultado={4_500_000}
        respuesta={<>Ganó <b>12,5% más</b> que el mes pasado.</>}
        respuestaTono="ok"
        subtitulo="Resultado operacional de julio · devengado"
      />
    ),
    margenes,
    comparativos,
    cascada: <CascadaResultado entradas={PNL} />,
    movibles: MOVIBLES,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("El negocio ganó este mes")).toBeInTheDocument();
    // "$4.500.000" aparece 3 veces (hero + EBITDA + resultado de la cascada).
    await waitFor(() => expect(canvas.getAllByText("$4.500.000").length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    // La cascada.
    await expect(canvas.getByText("Ingresos")).toBeInTheDocument();
    await expect(canvas.getByText("−$21.400.000")).toBeInTheDocument();
    // Cajas movibles: drivers + Pulso, con asa.
    await expect(canvas.getByText("Ventas")).toBeInTheDocument();
    await expect(canvas.getByText("Pulso del negocio")).toBeInTheDocument();
    expect(canvas.getAllByRole("button", { name: /hacia abajo/ })).toHaveLength(2);
  },
};
