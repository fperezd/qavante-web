import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PulsoCard } from "./pulso-card";

/* El Pulso (marca) con anillo centrado, factores como chips y la tendencia de 30
   días abajo — el score deja de ser un número suelto. */

const BAJANDO = [58, 55, 57, 52, 49, 50, 45, 42, 40, 37, 35, 34, 33];
const SUBIENDO = [71, 70, 73, 72, 75, 74, 77, 79, 80, 82, 83, 84];

const meta = {
  title: "Inicio v2 / PulsoCard",
  component: PulsoCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          '"Pulso del negocio" (término de marca · no se renombra). Confianza de los datos + factores + tendencia de 30 días (serie del snapshot q_score, ADR-0064).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PulsoCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critica: Story = {
  args: {
    score: 33,
    status: "critical",
    confianza: "Confianza de los datos: alta",
    tendencia: BAJANDO,
    delta: "▼ de 58 a 33 en 30 días",
    factores: [
      { label: "Días de caja: 0", tono: "crit" },
      { label: "Cobertura de pagos: parcial", tono: "crit" },
      { label: "Vencido: $0", tono: "ok" },
      { label: "Vencimientos concentrados", tono: "warn" },
    ],
  },
};

export const Sana: Story = {
  args: {
    score: 84,
    status: "stable",
    confianza: "Confianza de los datos: alta",
    tendencia: SUBIENDO,
    delta: "▲ de 71 a 84 en 30 días",
    factores: [
      { label: "Días de caja: 96", tono: "ok" },
      { label: "Cobertura de pagos: 100%", tono: "ok" },
      { label: "Vencido: $0", tono: "ok" },
      { label: "Márgenes al alza", tono: "ok" },
    ],
  },
};

export const Interaccion: Story = {
  name: "Marca + confianza + tendencia",
  args: { ...Critica.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pulso del negocio")).toBeInTheDocument();
    await expect(canvas.queryByText(/Confianza de los datos/)).not.toBeInTheDocument();
    await expect(canvas.getByText(/de 58 a 33/)).toBeInTheDocument();
  },
};

/* El caso que el pase §6 dejó sin una sola aserción, y donde vivían DOS mutantes que reponían
   el verde: con `status: null` el delta se pintaba `text-success-700` y el sparkline `success`,
   en la MISMA tarjeta donde el anillo ya decía "Sin datos".

   Va con `play` y no sólo como args: sin `play` la story verifica que monta, nada más. */
export const SinDatos: Story = {
  name: "Sin datos (la API se abstiene)",
  args: {
    score: null,
    status: null,
    confianza: "Confianza de los datos: baja",
    tendencia: BAJANDO,
    delta: "▼ de 58 a 33 en 30 días",
    factores: [{ label: "Falta el saldo de apertura", tono: "crit" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sin datos")).toBeInTheDocument();
    await expect(canvas.getByText("·")).toBeInTheDocument();
    await expect(canvas.queryByText("Estable")).not.toBeInTheDocument();

    // El delta NO se pinta en verde. Es el defecto que este PR cierra, en la superficie que
    // no decía la palabra pero sí el color.
    const delta = canvas.getByText(/de 58 a 33/);
    await expect(delta.className).toContain("text-neutral-mid");
    await expect(delta.className).not.toContain("success");

    // Y nada del anillo ni de la tendencia queda verde. El sparkline pinta su tono como
    // `stroke`, NO como clase: mirar solo clases dejaba vivo el mutante que le devuelve el
    // tono `success`. Se afirman las dos formas.
    await expect(canvasElement.querySelectorAll('[class*="success"]').length).toBe(0);
    const trazos = [...canvasElement.querySelectorAll("path[stroke], polyline[stroke]")].map((e) =>
      e.getAttribute("stroke"),
    );
    await expect(trazos.some((c) => c?.includes("success"))).toBe(false);
    await expect(trazos.some((c) => c?.includes("neutral-mid"))).toBe(true);
  },
};

/** EL CONTRAPESO, con la MISMA aserción en positivo: con un estado real la tarjeta SÍ se
 *  pronuncia y SÍ usa su color. Sin este par, "no pintes verde" se satisface no pintando nunca
 *  verde, y el Pulso es el indicador de portada. */
export const SinDatosContrapeso: Story = {
  name: "Con estado real (contrapeso)",
  args: {
    score: 78,
    status: "stable",
    confianza: "Confianza de los datos: alta",
    tendencia: SUBIENDO,
    delta: "▲ de 71 a 84 en 30 días",
    factores: [{ label: "Días de caja: 45", tono: "ok" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Estable")).toBeInTheDocument();
    await expect(canvas.queryByText("Sin datos")).not.toBeInTheDocument();

    const delta = canvas.getByText(/de 71 a 84/);
    await expect(delta.className).toContain("success");
  },
};
