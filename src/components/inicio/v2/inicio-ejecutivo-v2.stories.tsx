import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { InicioEjecutivoV2 } from "./inicio-ejecutivo-v2";
import { BrechaPlan } from "./brecha-plan";
import { CajaProyeccion } from "./caja-proyeccion";
import { CobranzaRealizable } from "./cobranza-realizable";
import { PagosTimeline } from "./pagos-timeline";
import { ResultadoPreliminar } from "./resultado-preliminar";
import { CalidadDato } from "./calidad-dato";
import { AccionesList } from "./acciones-list";

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

export const Sana: Story = {
  name: "Empresa sana (ilustrativo)",
  args: {
    frase: (
      <>
        La caja cubre <b>3,2 meses</b> de operación y el resultado crece <b>+12%</b>. Sin pagos
        en riesgo: es momento de mirar rentabilidad y crecimiento.
      </>
    ),
    termometros: [
      {
        n: 2,
        pregunta: "¿La empresa está ganando dinero?",
        pill: "🟢 Sano",
        pillTono: "ok",
        destacado: "ok",
        respuesta:
          "Margen operacional 42% · resultado +$12,4M (↑12%). Costos estables · sin alzas relevantes.",
        masLabel: "Ver rentabilidad →",
      },
      {
        n: 3,
        pregunta: "¿La empresa tiene ingresos futuros para crecer sin tensionar la caja?",
        pill: "🟢 Favorable · estimado",
        pillTono: "ok",
        destacado: "ok",
        respuesta:
          "Señales favorables (estimación por recurrencia observada): recurrentes 72% · ventas +18% mensual · 1 cliente concentra 38%.",
        masLabel: "Ver crecimiento →",
      },
      {
        n: 1,
        pregunta: "¿La caja cubre la operación?",
        pill: "🟢 Holgado",
        pillTono: "ok",
        respuesta: "3,2 meses de caja. Sin pagos en riesgo.",
        masLabel: "Ver caja →",
      },
    ],
    pulso: {
      score: 84,
      status: "stable",
      confianza: "Confianza de los datos: alta",
      delta: "▲ de 71 a 84 en 30 días",
      tendencia: [71, 70, 73, 72, 75, 74, 77, 79, 80, 82, 83, 84],
      factores: [
        { label: "Días de caja: 96", tono: "ok" },
        { label: "Cobertura de pagos: 100%", tono: "ok" },
        { label: "Vencido: $0", tono: "ok" },
        { label: "Márgenes al alza", tono: "ok" },
      ],
    },
    plan: (
      <AccionesList
        titulo="Qué hacer para crecer"
        acciones={[
          {
            rank: 1,
            titulo: "Las ventas crecen +18% mes a mes",
            detalle: "Conviene sostener la caja para financiar el crecimiento (tendencia del SII)",
            plazo: "Seguimiento",
            cta: "Ver ventas →",
          },
          {
            rank: 2,
            titulo: "Excedente estimado sobre el colchón operativo",
            detalle: "$22,0M — evaluar alternativas: reserva · prepagar deuda · crecimiento · invertir",
            plazo: "Trimestre",
            cta: "Ver alternativas →",
          },
          {
            rank: 3,
            titulo: "Un cliente concentra el 38% de las ventas",
            detalle: "Riesgo de dependencia (dato del SII)",
            plazo: "Estratégico",
            cta: "Ver concentración →",
          },
        ]}
      />
    ),
    grid: [
      <ResultadoPreliminar
        key="resultado"
        resultado={12_400_000}
        subtitulo="Resultado operacional · ↑12% vs mes anterior"
        ingresos={29_500_000}
        margenLabel="Margen operacional"
        margen="42%"
        extra={[
          { label: "Costo que más creció", valor: "Sin alzas relevantes" },
          { label: "Concentración de ventas", valor: "1 cliente · 38%" },
        ]}
      />,
      <CajaProyeccion
        key="caja"
        cajaHoy={28_400_000}
        subtitulo="Caja hoy · 3,2 meses de autonomía"
        serie={[12_000_000, 15_000_000, 18_000_000, 21_000_000, 24_000_000, 26_500_000, 28_400_000]}
        filas={[
          { label: "Mínima a 30 días", valor: "$19.200.000", tono: "pos" },
          { label: "Días de caja", valor: "96", tono: "pos" },
          { label: "Colchón objetivo", valor: "✓ cubierto", tono: "pos" },
        ]}
        stamp="Caja hoy · Actualizado hoy · banco"
      />,
      <CobranzaRealizable
        key="cobranza"
        esperadoATiempo={34_000_000}
        subtitulo="Cobranza esperada a tiempo · 14 días"
        totalPorCobrar={180_000_000}
        vencido={0}
        segmentos={[
          { label: "Alta prob. — pagan a tiempo", monto: 34_000_000, banda: "high" },
          { label: "Probable", monto: 8_000_000, banda: "probable" },
          { label: "Sin patrón claro", monto: 3_000_000, banda: "unknown" },
        ]}
      />,
      <PagosTimeline
        key="pagos"
        total={14_200_000}
        subtitulo="Cubiertos por la caja proyectada a su fecha de vencimiento"
        pagos={[
          { fecha: "Vence 30", nombre: "Remuneraciones", monto: 8_600_000, tipo: "cubierto" },
          { fecha: "Vence día 20", nombre: "IVA / F29", monto: 4_200_000, tipo: "cubierto" },
          { fecha: "Próx. 14 días", nombre: "Proveedores", monto: 1_400_000, tipo: "cubierto" },
        ]}
      />,
    ],
  },
};

export const ControlDeGestion: Story = {
  name: "Lente control de gestión",
  args: {
    frase: (
      <>
        Vista de <b>control de gestión</b> — rentabilidad y márgenes primero. La continuidad
        queda fijada abajo (nunca se oculta).
      </>
    ),
    termometros: [
      {
        n: 2,
        pregunta: "¿La empresa está ganando dinero?",
        pill: "🟢 Positivo · foco",
        pillTono: "ok",
        destacado: "focus",
        respuesta:
          "Resultado +$7,9M · margen 89% (preliminar). Evolución de costos y concentración de ventas.",
        masLabel: "Ver rentabilidad →",
      },
      {
        n: 3,
        pregunta: "¿La empresa tiene ingresos futuros para crecer sin tensionar la caja?",
        pill: "🟢 Estimado",
        pillTono: "ok",
        respuesta: "Estimados según la recurrencia observada (SII).",
        masLabel: "Ver crecimiento →",
      },
      {
        n: 1,
        pregunta: "¿La caja cubre la operación?",
        pill: "🔴 Crítico · fijado",
        pillTono: "crit",
        destacado: "crit",
        respuesta:
          "Debe asegurar $9,96M a 14 días. No se oculta aunque se priorice la rentabilidad.",
        masLabel: "Ver plan →",
      },
    ],
    pulso: (Crisis.args as NonNullable<typeof Crisis.args>).pulso!,
    plan: (
      <AccionesList
        titulo="Análisis de gestión · con lo que tenemos"
        acciones={[
          {
            rank: 1,
            titulo: "Un cliente concentra el 38% de las ventas",
            detalle: "Ingreso expuesto: $3,4M/mes si ese cliente cae (dato del SII)",
            plazo: "Estructural",
            cta: "Ver concentración →",
          },
          {
            rank: 2,
            titulo: "Los servicios subieron 18% este mes",
            detalle: "Impacto estimado en el margen del mes: −$0,6M (clasificación del SII)",
            plazo: "Este mes",
            plazoTono: "warn",
            cta: "Ver costos →",
          },
          {
            rank: 3,
            titulo: "El ciclo de caja se alargó a 42 días",
            detalle: "Capital de trabajo inmovilizado: ~$4,1M (cobra a 42d, paga a 28d — conciliación)",
            plazo: "Seguimiento",
            cta: "Ver cobranza →",
          },
        ]}
        pin={{
          texto: "⚠ Continuidad fijada — la empresa aún debe asegurar $9,96M a 14 días",
          cta: "Ver plan →",
        }}
      />
    ),
    grid: (Crisis.args as NonNullable<typeof Crisis.args>).grid!,
    calidad: (Crisis.args as NonNullable<typeof Crisis.args>).calidad,
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
