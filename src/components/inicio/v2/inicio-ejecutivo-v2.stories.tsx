import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { InicioEjecutivoV2 } from "./inicio-ejecutivo-v2";
import { BrechaPlan } from "./brecha-plan";
import { CajaProyeccion } from "./caja-proyeccion";
import { CobranzaRealizable } from "./cobranza-realizable";
import { PagosTimeline } from "./pagos-timeline";
import { ResultadoPreliminar } from "./resultado-preliminar";
import { CalidadDato } from "./calidad-dato";

/* El Inicio Ejecutivo v2 armado end-to-end en el escenario de crisis: frase →
   3 termómetros → cockpit (Pulso + Plan de brecha) → grid de detalle → calidad.
   Todos presentacionales; en la app las 4 tarjetas del grid serán reordenables. */

const meta = {
  title: "Inicio v2 / _Inicio Ejecutivo (composición)",
  component: InicioEjecutivoV2,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Composición completa del rediseño aprobado (2026-07-12). Diagnóstico → plan cuantificado → evidencia → rentabilidad → crecimiento, en tercera persona y con dato trazable a SII + banco.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1120px] bg-bg p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InicioEjecutivoV2>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    frase: (
      <>
        La caja hoy es <b>−$1,5M</b> y tocará un mínimo de <b>−$5,7M</b> en los próximos 14
        días. Para cubrir los pagos críticos, la empresa debe asegurar <b>$9,96M</b> antes de
        sus vencimientos.
      </>
    ),
    termometros: [
      {
        n: 1,
        pregunta: "¿La caja cubre la operación?",
        pill: "🔴 Crítico",
        pillTono: "crit",
        destacado: "crit",
        respuesta: "Debe asegurar $9,96M para los pagos de 14 días. Runway 0 días.",
        masLabel: "Ver plan ↓",
      },
      {
        n: 2,
        pregunta: "¿La empresa está ganando dinero?",
        pill: "🟢 Positivo",
        pillTono: "ok",
        respuesta:
          "Resultado +$7,9M este mes · margen 89% (preliminar). Costos y concentración de ventas bajo seguimiento.",
        masLabel: "Ver rentabilidad →",
      },
      {
        n: 3,
        pregunta: "¿La empresa tiene ingresos futuros para crecer sin tensionar la caja?",
        pill: "🟢 Estimado",
        pillTono: "ok",
        respuesta:
          "Estimados según la recurrencia observada: ingresos recurrentes, concentración de clientes y tendencia de ventas (SII).",
        masLabel: "Ver crecimiento →",
      },
    ],
    pulso: {
      score: 33,
      status: "critical",
      confianza: "Confianza de los datos: alta",
      delta: "▼ de 58 a 33 en 30 días",
      tendencia: [58, 55, 57, 52, 49, 50, 45, 42, 40, 37, 35, 34, 33],
      factores: [
        { label: "Días de caja: 0", tono: "crit" },
        { label: "Cobertura de pagos: parcial", tono: "crit" },
        { label: "Vencido: $0", tono: "ok" },
        { label: "Vencimientos concentrados", tono: "warn" },
      ],
    },
    plan: (
      <BrechaPlan
        brechaTotal={9_956_127}
        coberturaIdentificada={9_100_000}
        pendienteAsegurar={860_000}
        acciones={[
          {
            titulo: "Cobrar a clientes que pagan a tiempo",
            impacto: 7_800_000,
            fecha: "7 días",
            estado: "probable",
            brechaRestante: -2_160_000,
          },
          {
            titulo: "Reprogramar pagos negociables (proveedores)",
            impacto: 1_300_000,
            fecha: "10 días",
            estado: "en_negociacion",
            brechaRestante: -860_000,
          },
          {
            titulo: "Evaluar cobertura financiera (línea / factoring)",
            impacto: 860_000,
            fecha: "14 días",
            estado: "por_evaluar",
            brechaRestante: 0,
            restanteNota: "si se aprueba",
          },
        ]}
      />
    ),
    grid: [
      <CajaProyeccion
        key="caja"
        cajaHoy={-1_518_883}
        subtitulo="Caja hoy · estimada"
        serie={[2_000_000, 1_100_000, 0, -1_518_883, -3_100_000, -4_500_000, -5_737_505]}
        filas={[
          { label: "Mínima a 14 días", valor: "−$5.737.505", tono: "neg" },
          { label: "Mínima a 30 días", valor: "−$5.737.505", tono: "neg" },
          { label: "Días de caja", valor: "~0", tono: "neg" },
        ]}
        stamp="Caja hoy · Actualizado 08-07 20:00 · banco"
      />,
      <CobranzaRealizable
        key="cobranza"
        esperadoATiempo={7_800_000}
        subtitulo="Cobranza esperada a tiempo · próximos 14 días"
        totalPorCobrar={205_400_000}
        vencido={0}
        segmentos={[
          { label: "Alta prob. — pagan a tiempo", monto: 7_800_000, banda: "high" },
          { label: "Probable — pago irregular", monto: 4_300_000, banda: "probable" },
          { label: "Sin patrón de pago claro", monto: 6_100_000, banda: "unknown" },
        ]}
      />,
      <PagosTimeline
        key="pagos"
        total={16_614_448}
        totalEnRojo
        subtitulo="Vencidos o exigibles durante los próximos 14 días"
        pagos={[
          { fecha: "Venció 30-06", nombre: "Remuneraciones", monto: 8_600_000, tipo: "no_postergable", vencido: true },
          { fecha: "Vence día 20", nombre: "IVA / F29", monto: 4_214_448, tipo: "no_postergable" },
          { fecha: "Próx. 14 días", nombre: "Proveedores", monto: 3_800_000, tipo: "negociable" },
        ]}
      />,
      <ResultadoPreliminar
        key="resultado"
        resultado={7_926_679}
        subtitulo="Resultado operacional · julio"
        ingresos={8_855_032}
        margenLabel="Margen operacional preliminar"
        margen="89%"
        caveat="Puede cambiar al completar 195 movimientos por clasificar · impacto máx. pendiente $3,4M"
        rango="entre 51% y 89%"
        extra={[
          { label: "Costo que más creció", valor: "Servicios +18%", tono: "warn" },
          { label: "Concentración de ventas", valor: "1 cliente · 38%" },
        ]}
      />,
    ],
    calidad: (
      <CalidadDato
        texto={
          <>
            Hay <b>195 movimientos</b> sin clasificar por <b>hasta $3,4M</b> — pueden cambiar
            la caja y el resultado estimado.
          </>
        }
        ctaLabel="Clasificar →"
      />
    ),
  },
};

export const Interaccion: Story = {
  name: "Recorrido completo del dueño",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Diagnóstico (Pulso, marca) + plan cuantificado + evidencia, todo presente.
    await expect(canvas.getByText("Pulso del negocio")).toBeInTheDocument();
    await expect(canvas.getByText(/Plan para cubrir la brecha/)).toBeInTheDocument();
    await expect(canvas.getByText("¿La caja cubre la operación?")).toBeInTheDocument();
    await expect(canvas.getByText(/Pagos críticos vencidos y próximos/)).toBeInTheDocument();
    await expect(canvas.getByText("Calidad de la información")).toBeInTheDocument();
  },
};
