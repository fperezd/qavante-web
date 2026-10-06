import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { TopDebtors } from "./cobrar-view";

/* Los TRES estados del vencido POR DEUDOR, en la tabla de Cobrar **v1**.
 *
 * Por qué acá y también en `cobrar-view.stories.tsx`: el patrón de la casa
 * (ADR-0018) permite fijar la semántica del presentacional de forma aislada; el
 * container ahora tiene sus propias plays MSW desde que #95 fijó el host de
 * Storybook en un dominio `.invalid` que no sale a producción.
 *
 * Por qué importa que sea v1, y esto costó varias correcciones hasta quedar bien: ninguna
 * ruta monta esta vista. `/cobrar` sirve `GestionCobrosLive` + el directorio de deudores, y los
 * flags que decidían entre v1 y v2 (`accountsReceivable`, `cobrarV2`) se retiraron el 2026-10-05
 * porque estaban declarados y nunca leídos. No es "el camino por defecto" ni la configuración de
 * rollback vigente: es la pieza a la que Cobrar volvería si retrocede, y ahí es exactamente
 * cuando menos se quiere una mentira en pantalla, así que se cubre igual.
 *
 * CUÁNDO BORRAR ESTE ARCHIVO: el día que v1 se jubile, como ya se jubiló Gestión v1
 * (`wrangler.toml`). Si `CobrarView` desaparece, estas stories se van en el MISMO PR del
 * retiro — no se quedan cubriendo un componente muerto. Lo anota acá el pase §6 para que
 * el que haga ese retiro no tenga que deducirlo.
 *
 * Tres stories y no una: lo que hay que fijar no es que el "no sé" aparezca, sino que
 * los tres casos se vean DISTINTOS entre sí. Un cero verificado y un desconocido
 * pintados igual es el bug entero (qavante-api#124: "La tabla no debe renderizarlo
 * como $0"). Tampoco como nada. */

const deudor = (overdue: string | null) => ({
  name: "COMERCIAL KAUFMANN S.A.",
  rut: "96.572.360-9",
  total: "24741616",
  overdue,
});

const meta = {
  title: "Capa 2 / Cobrar / TopDebtors",
  component: TopDebtors,
  parameters: { layout: "padded" },
  args: { total: "32648098", siiEnabled: false },
} satisfies Meta<typeof TopDebtors>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VencidoDesconocido: Story = {
  name: "Vencido desconocido (el caso de producción)",
  args: { debtors: [deudor(null)] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("vencido: no se sabe")).toBeInTheDocument();
    /* El ancla va al ARRANQUE y acepta el menos tipográfico: `formatClp` de un negativo
       rinde "−$120.000", con U+2212 antes del "$". Un `/vencido$/` no casaría nunca,
       porque el texto real puede seguir. */
    await expect(c.queryByText(/^[−-]?\$.*vencido/)).not.toBeInTheDocument();
  },
};

export const VencidoCeroVerificado: Story = {
  name: "Cero verificado · está al día",
  args: { debtors: [deudor("0")] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("vencido: no se sabe")).not.toBeInTheDocument();
    await expect(c.queryByText(/^[−-]?\$.*vencido/)).not.toBeInTheDocument();
  },
};

export const VencidoConocido: Story = {
  name: "Vencido conocido",
  args: { debtors: [deudor("3500000")] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("vencido: no se sabe")).not.toBeInTheDocument();
    await expect(c.getByText(/^[−-]?\$.*vencido/)).toBeInTheDocument();
  },
};
