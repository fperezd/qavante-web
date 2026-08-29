import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PulsoRing } from "./pulso-ring";

const meta = {
  title: "Inicio / PulsoRing",
  component: PulsoRing,
  parameters: {
    docs: {
      description: {
        component:
          "Anillo del Pulso (nivel dios). El score llena el anillo, respira sutilmente y el color comunica el estado de un vistazo. El número cuenta desde 0. Respeta prefers-reduced-motion.",
      },
    },
  },
  args: { score: 60, status: "critical" },
} satisfies Meta<typeof PulsoRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critica: Story = { args: { score: 60, status: "critical" } };
export const Debil: Story = { args: { score: 45, status: "weak" } };
export const Estable: Story = { args: { score: 72, status: "stable" } };
export const Fuerte: Story = { args: { score: 91, status: "strong" } };

/** La API se ABSTUVO: sin saldo de apertura el Pulso es preliminar (qavante-api#162).
 *
 *  Antes este caso se pintaba como `Estable` -- verde, 0 -- sobre tenants de los que no se sabia
 *  nada. Medido en produccion sobre una caja en -$1.121.250, en la misma respuesta que reportaba
 *  la brecha. */
export const SinDatos: Story = {
  args: { score: null, status: null },
  play: async ({ canvasElement }) => {
    // Sin `play` la story solo verifica que MONTA. Los mutantes que reponen el verde -- el
    // anillo lleno, el latido, el color de exito -- sobrevivian con la suite entera verde,
    // porque la unica cobertura del componente era la del modelo puro.
    const c = within(canvasElement);
    await expect(c.getByText("Sin datos")).toBeInTheDocument();
    await expect(c.getByText("—")).toBeInTheDocument();
    await expect(c.queryByText("Estable")).not.toBeInTheDocument();

    const anillo = canvasElement.querySelector('[role="img"]');
    await expect(anillo).toHaveAttribute(
      "aria-label",
      "Pulso del negocio: sin datos suficientes para calcularlo",
    );
    // El anillo NO late: respirando se lee como "calculando", y no esta calculando nada.
    await expect(canvasElement.querySelector(".animate-qv-breathe")).toBeNull();
    // Y esta VACIO: `strokeDashoffset === CIRC` deja el arco sin pintar.
    const arco = canvasElement.querySelectorAll("circle")[1];
    await expect(arco).toBeDefined();
    await expect(Number(arco?.getAttribute("stroke-dashoffset"))).toBeCloseTo(2 * Math.PI * 54, 1);
  },
};

/** EL CONTRAPESO de la story de arriba: con un estado real el anillo SI se pronuncia, late y se
 *  llena. Sin este par, "no inventes" se satisface no mostrando nunca nada. */
export const SinDatosContrapeso: Story = {
  name: "Con estado real (contrapeso)",
  args: { score: 72, status: "stable" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Estable")).toBeInTheDocument();
    await expect(c.queryByText("Sin datos")).not.toBeInTheDocument();
    await expect(canvasElement.querySelector(".animate-qv-breathe")).not.toBeNull();
  },
};

export const Panel: Story = {
  name: "Los cuatro estados y el 'no se'",
  render: () => (
    <div className="flex flex-wrap gap-6">
      <PulsoRing score={91} status="strong" />
      <PulsoRing score={72} status="stable" />
      <PulsoRing score={45} status="weak" />
      <PulsoRing score={60} status="critical" />
      <PulsoRing score={null} status={null} />
    </div>
  ),
};
