import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CashGapBanner } from "./inicio-ejecutivo-view";
import { DEFICIT } from "./resumen/inicio-resumen.fixtures";

/* Banner de brecha de caja del Inicio, PRESENTACIONAL: el bloque del contrato entra, una frase sale.
 *
 * Existe separado de `inicio-ejecutivo-view.stories.tsx` porque aquéllas pasan por
 * `useDashboardSummary` y en CI (job `test-storybook`) y en Chromatic no hay
 * `NEXT_PUBLIC_API_URL`, así que rinden el error de configuración en vez del dashboard. Acá no
 * hay red: los casos se ven de verdad, y los `play` corren en el navegador headless.
 *
 * Los números son los del fixture canónico del repo (`inicio-resumen.fixtures.ts`): brecha
 * publicada 14.000.000, saldo final −10.000.000, mínimo −14.000.000, críticas 34.800.000. El
 * titular es la brecha publicada (D01/D03, #296); las otras cifras van en el desglose, cada una
 * con su nombre. */
const meta = {
  title: "Capa 2 / Inicio / CashGapBanner",
  component: CashGapBanner,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Banner de brecha de caja a 14 días. El faltante es `cash_gap_amount_14d` tal como lo publica el servidor: no se reconstruye restando obligaciones a la caja ni se publica el saldo final con el signo cambiado. Mínimo, saldo al día 14 y pagos críticos se muestran por separado.",
      },
    },
  },
} satisfies Meta<typeof CashGapBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Brecha: Story = {
  name: "Brecha publicada por el servidor (14M con saldo final −10M)",
  args: { summary: DEFICIT },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent(
      "Te faltan $14.000.000 para que tu caja no quede bajo cero en los próximos 14 días",
    );
    /* Lo que NO puede decir como faltante: el saldo final (−10M) ni críticas menos caja
       (44,8M). GEMELO POSITIVO en la misma story: el saldo final SÍ aparece, con su apellido. */
    await expect(alerta).not.toHaveTextContent("Te faltan $10.000.000");
    await expect(alerta).not.toHaveTextContent("$44.800.000");
    await expect(alerta).toHaveTextContent("saldo al día 14 −$10.000.000");
    await expect(alerta).toHaveTextContent("pagos críticos $34.800.000");
  },
};

export const CierrePositivo: Story = {
  name: "Cierre positivo con valle intermedio: la brecha sigue siendo la publicada",
  /* Un saldo final positivo no borra un faltante intermedio (D03). La rama anterior habría
     publicado críticas − caja = $29.800.000. */
  args: {
    summary: { ...DEFICIT, cash_gap: { ...DEFICIT.cash_gap!, projected_cash_14d: "5000000" } },
  },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent("Te faltan $14.000.000");
    await expect(alerta).not.toHaveTextContent("$29.800.000");
    await expect(alerta).toHaveTextContent("saldo al día 14 $5.000.000");
  },
};

export const Declarada: Story = {
  name: "Brecha declarada sin monto publicado (declared)",
  /* `has_gap` del backend sin `cash_gap_amount_14d` legible: ni "te faltan $0" ni un número
     reconstruido desde las otras cifras. */
  args: {
    summary: { ...DEFICIT, cash_gap: { ...DEFICIT.cash_gap!, cash_gap_amount_14d: "" } },
  },
  play: async ({ canvasElement }) => {
    const alerta = within(canvasElement).getByRole("alert");
    await expect(alerta).toHaveTextContent(
      "Hay una brecha de caja declarada para los próximos 14 días",
    );
    await expect(alerta).not.toHaveTextContent("Te faltan");
    await expect(alerta).not.toHaveTextContent("$0");
  },
};
