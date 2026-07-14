import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { PagarV2View, type PagarMovible } from "./pagar-v2-view";
import { PagarHero } from "./pagar-hero";
import { BrechaCaja } from "./brecha-caja";
import { FechasClaveMes } from "./fechas-clave-mes";
import { VencimientosTimeline } from "./vencimientos-timeline";
import { ConcentracionClientes } from "@/components/sii/libro-v2/concentracion-clientes";

/* Pantalla de Pagar v2 ensamblada: respuesta de dueño (hero + brecha + secundarios) +
   "Las 3 del mes" (baranda) + cajas movibles (vencimientos + mayores compromisos). */

const meta = {
  title: "Propuestas / Pagar / Pantalla completa",
  component: PagarV2View,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="mx-auto max-w-[1120px] p-6"><Story /></div>],
} satisfies Meta<typeof PagarV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

const secundarios = (
  <div className="p-5">
    <dl className="flex flex-col text-[13px]">
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <dt className="text-neutral-mid">Vencido</dt>
        <dd className="font-bold tabular-nums text-danger-500">$6.200.000</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">Próximos 7 días</dt>
        <dd className="font-bold tabular-nums text-warning-700">$12.800.000</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">Este mes</dt>
        <dd className="font-bold tabular-nums text-neutral-dark">$34.525.000</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
        <dt className="text-neutral-mid">En dólares</dt>
        <dd className="font-bold tabular-nums text-brand-primary">US$1.329</dd>
      </div>
    </dl>
  </div>
);

const cardVencimientos = (
  <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <h2 className="text-sm font-bold text-neutral-dark">Por vencer y vencidos</h2>
      <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11.5px] font-bold text-brand-primary">14 pagos</span>
      <span className="rounded-full bg-danger-500/10 px-2.5 py-0.5 text-[11.5px] font-bold text-danger-500">1 vencido</span>
    </div>
    <VencimientosTimeline
      items={[
        { id: "1", vencido: true, fecha: "10-07", acreedor: "COMERCIAL KAUFMANN S.A.", detalle: "Proveedor · factura 8842", monto: 2_100_000, postergabilidad: "negociable" },
        { id: "2", fecha: "13-07", acreedor: "Previred — cotizaciones", detalle: "Leyes sociales · junio", monto: 3_850_000, postergabilidad: "no_postergable" },
        { id: "3", fecha: "15-07", acreedor: "Google Cloud", detalle: "Servicio · compra extranjera", monto: 1_190_000, montoOrigen: "US$1.240", postergabilidad: "negociable" },
        { id: "4", fecha: "20-07", acreedor: "F29 — IVA a pagar", detalle: "Impuesto SII · junio", monto: 4_200_000, postergabilidad: "no_postergable" },
        { id: "5", fecha: "25-07", acreedor: "DIVEIMPORT S.A.", detalle: "Proveedor · factura 1043", monto: 3_400_000, postergabilidad: "cubierto" },
      ]}
    />
  </div>
);

const cardCompromisos = (
  <ConcentracionClientes
    titulo="Mayores compromisos"
    items={[
      { nombre: "Sueldos — empleados", rut: "", monto: 8_900_000, pct: 26 },
      { nombre: "SII — F29 / IVA", rut: "", monto: 4_200_000, pct: 12 },
      { nombre: "Previred", rut: "", monto: 3_850_000, pct: 11 },
      { nombre: "DIVEIMPORT S.A.", rut: "76.008.959-1", monto: 3_400_000, pct: 10 },
      { nombre: "Leasing furgón", rut: "", monto: 2_400_000, pct: 7 },
      { nombre: "COMERCIAL KAUFMANN", rut: "96.572.360-9", monto: 2_100_000, pct: 6 },
    ]}
  />
);

const MOVIBLES: PagarMovible[] = [
  { id: "vencimientos", label: "Por vencer y vencidos", node: cardVencimientos },
  { id: "compromisos", label: "Mayores compromisos", node: cardCompromisos },
];

export const Completa: Story = {
  args: {
    hero: (
      <PagarHero
        titulo="La empresa debe pagar"
        montoTotal={34_525_000}
        cobertura={
          <>
            La caja no alcanza: faltan <b>$8.700.000</b> para los pagos críticos de 14 días.
          </>
        }
        coberturaTono="bad"
        subtitulo="5 vencimientos esta semana · 1 vencido"
      />
    ),
    brecha: <BrechaCaja cajaProyectada={9_400_000} pagosCriticos={18_100_000} dias={14} postergable={5_500_000} />,
    secundarios,
    fechasClave: (
      <FechasClaveMes
        total={16_950_000}
        items={[
          { id: "imp", label: "Imposiciones · Previred", monto: 3_850_000, vence: "13-jul", enDias: 1, icono: "imposiciones" },
          { id: "iva", label: "Impuestos · F29 (IVA)", monto: 4_200_000, vence: "20-jul", enDias: 6, icono: "impuestos" },
          { id: "sue", label: "Sueldos · 6 empleados", monto: 8_900_000, vence: "30-jul", enDias: 16, icono: "sueldos" },
        ]}
      />
    ),
    movibles: MOVIBLES,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("La empresa debe pagar")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$34.525.000")).toBeInTheDocument(), { timeout: 3000 });
    // Brecha + las 3 del mes.
    await expect(canvas.getByText(/es postergable/)).toBeInTheDocument();
    await expect(canvas.getByText("Imposiciones · Previred")).toBeInTheDocument();
    // Cajas movibles: vencimientos + mayores compromisos, con asa.
    await expect(canvas.getByText("Por vencer y vencidos")).toBeInTheDocument();
    await expect(canvas.getByText("Mayores compromisos")).toBeInTheDocument();
    expect(canvas.getAllByRole("button", { name: /hacia abajo/ })).toHaveLength(2);
  },
};
