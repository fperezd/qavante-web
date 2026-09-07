import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CashGapBanner } from "./inicio-ejecutivo-view";

/* Banner de brecha de caja del Inicio, PRESENTACIONAL: dos números entran, una frase sale.
 *
 * Existe separado de `inicio-ejecutivo-view.stories.tsx` porque aquéllas pasan por
 * `useDashboardSummary` y en CI (job `test-storybook`) y en Chromatic no hay
 * `NEXT_PUBLIC_API_URL`, así que rinden el error de configuración en vez del dashboard. Acá no
 * hay red: los cuatro casos se ven de verdad, y los `play` corren en el navegador headless.
 *
 * Los cuatro casos que `describeCashGap14d` distingue, con los números canónicos de
 * `cash-gap-14d.ts`. El caso mixto (`overdraft_with_dues`) no tenía ninguna story (#54 §3), que
 * es justo la rama donde el signo de la cifra decide si el dueño lee "tengo" o "debo". */
const meta = {
  title: "Capa 2 / Inicio / CashGapBanner",
  component: CashGapBanner,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Banner de brecha de caja a 14 días. El copy cambia de sentido según el caso: faltante contra pagos críticos (shortfall), caja bajo cero sin pagos (overdraft), caja bajo cero CON pagos (mixto) y brecha declarada que no cuantificamos (declared). Los montos no se suman: la caja proyectada ya trae los egresos críticos restados.",
      },
    },
  },
} satisfies Meta<typeof CashGapBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shortfall: Story = {
  name: "Faltante contra pagos críticos (shortfall)",
  args: { critical: 5_000_000, projected: 2_000_000 },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent(
      "Te faltan $3.000.000 para cubrir tus pagos críticos de los próximos 14 días",
    );
  },
};

export const Overdraft: Story = {
  name: "Caja bajo cero SIN pagos críticos (overdraft)",
  // Caso real Tooxs 2026-07-19.
  args: { critical: 0, projected: -3_935_682 },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent(
      "Tu caja proyectada a 14 días está bajo cero: −$3.935.682",
    );
    // No hay pagos críticos: no se puede hablar de un faltante contra ellos.
    await expect(alerta).not.toHaveTextContent("Te faltan");
  },
};

export const OverdraftConCriticas: Story = {
  name: "Caja bajo cero CON pagos críticos (caso mixto)",
  args: { critical: 2_000_000, projected: -1_000_000 },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    /* La frase entera: el signo (U+2212, no un guion) Y las palabras "bajo cero", con las dos
       cifras cada una con su apellido. */
    await expect(alerta).toHaveTextContent(
      "En 14 días tu caja proyectada llega a −$1.000.000. Incluye $2.000.000 en pagos que vencen en ese período.",
    );
    /* Lo que NO puede decir: la suma. La caja proyectada YA trae esos $2M restados, así que la
       plata a conseguir es $1M. GEMELO POSITIVO del mismo valor: la story `Shortfall` afirma
       "$3.000.000" cuando ésa sí es la cifra. */
    await expect(alerta).not.toHaveTextContent("$3.000.000");
  },
};

export const Declared: Story = {
  name: "Brecha declarada que no cuantificamos (declared)",
  /* `has_gap` del backend con críticas que la caja SÍ cubre: el valle intra-período lo ve él,
     no nosotros. Ni "te faltan $0" ni tranquilidad falsa. */
  args: { critical: 5_000_000, projected: 6_000_000 },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent(
      "Hay una brecha de caja declarada para los próximos 14 días",
    );
    await expect(alerta).not.toHaveTextContent("Te faltan");
  },
};
