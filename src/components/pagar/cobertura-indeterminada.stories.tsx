import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CoberturaDeCaja } from "./pagar-view";
import type { AccountsPayableResponse } from "@/lib/api/pagos";

/* El "no se puede determinar" de la cobertura de caja (#41).
 *
 * Antes de este cambio, `covers_critical === null` no renderizaba NADA: la línea de
 * cobertura desaparecía y el dueño no podía distinguir "la caja alcanza", "no alcanza" y
 * "no se puede saber". Y desde el #41 el `null` es el caso NORMAL —cualquier tenant con
 * deuda sin fecha de vencimiento— así que el silencio habría sido la respuesta más
 * frecuente de la pantalla.
 *
 * Estas stories afirman las dos cosas que importan: que el "no sé" SE DICE, y que dice el
 * PORQUÉ con el monto concreto en vez de una fórmula vaga. */

const base: AccountsPayableResponse = {
  total: "43634503",
  due_7d: "12372897",
  due_14d: "12407622",
  due_30d: "12407622",
  items: [],
  projected_cash_14d: null,
  covers_critical: null,
  undated_amount: "31226881",
  undated_count: 94,
  confidence: "medium",
  data_state: "partial",
  missing_sources: ["Vencimientos de documentos (XML del DTE, pendiente)"],
  generated_at: "2026-08-25T12:00:00Z",
};

const meta = {
  title: "Capa 2 / Pagar / CoberturaDeCaja",
  component: CoberturaDeCaja,
  parameters: { layout: "padded" },
  args: { data: base },
} satisfies Meta<typeof CoberturaDeCaja>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDeudaSinVencimiento: Story = {
  name: "Por deuda sin fecha de vencimiento",
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No podemos decirte si la caja alcanza/)).toBeInTheDocument();
    /* El monto y el conteo, no una fórmula: "hay $31.226.881 en 94 documentos sin fecha".
       Sin este assert, un texto genérico que no explique nada pasaría igual. */
    await expect(c.getByText(/31\.226\.881/)).toBeInTheDocument();
    await expect(c.getByText(/94 documentos/)).toBeInTheDocument();
    await expect(c.getByText(/piso/)).toBeInTheDocument();
  },
};

export const PorTipoDeCambioFaltante: Story = {
  name: "Por tipo de cambio pendiente",
  args: {
    data: {
      ...base,
      undated_amount: "0",
      undated_count: 0,
      missing_sources: ["Tipo de cambio USD→CLP pendiente (no se pudo sumar al total en CLP)"],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No podemos decirte si la caja alcanza/)).toBeInTheDocument();
    await expect(c.getByText(/tipo de cambio/i)).toBeInTheDocument();
    /* Y NO menciona documentos sin fecha, porque acá no los hay: la explicación tiene que
       corresponder a la causa real, no ser un catálogo de todas las causas posibles. */
    await expect(c.queryByText(/sin fecha de vencimiento/)).not.toBeInTheDocument();
  },
};

export const PorLasDos: Story = {
  name: "Las dos causas a la vez",
  args: {
    data: {
      ...base,
      missing_sources: [
        "Vencimientos de documentos (XML del DTE, pendiente)",
        "Tipo de cambio USD→CLP pendiente (no se pudo sumar al total en CLP)",
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/sin fecha de vencimiento/)).toBeInTheDocument();
    await expect(c.getByText(/tipo de cambio/i)).toBeInTheDocument();
  },
};

export const SinDetalleDelBackend: Story = {
  name: "Sin monto ni causa (degradación honesta)",
  args: {
    data: { ...base, undated_amount: undefined, undated_count: undefined, missing_sources: [] },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    /* Si el backend no manda ni el monto ni la causa, la frase principal SIGUE apareciendo:
       "no podemos decirte" es la información, y el detalle es el acompañamiento. Callar acá
       sería volver al bug que este componente vino a arreglar. */
    await expect(c.getByText(/No podemos decirte si la caja alcanza/)).toBeInTheDocument();
    await expect(c.getByText(/piso/)).toBeInTheDocument();
  },
};

/* ── Las otras dos ramas ──────────────────────────────────────────────────────
   Sin éstas, borrar la rama `=== false` o la `=== true` de `CoberturaDeCaja` pasaba en
   verde: el pase §6 midió exactamente eso — las stories montaban el presentacional del
   "no sé" directo y nunca ejercitaban el cableado. */

export const CajaAlcanza: Story = {
  name: "La caja alcanza",
  args: { data: { ...base, covers_critical: true, projected_cash_14d: "50000000" } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/cubre los pagos críticos/)).toBeInTheDocument();
    await expect(c.queryByText(/No podemos decirte/)).not.toBeInTheDocument();
  },
};

export const CajaNoAlcanza: Story = {
  name: "La caja NO alcanza",
  args: { data: { ...base, covers_critical: false, projected_cash_14d: "1000000" } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/no alcanza/)).toBeInTheDocument();
    /* El único rojo de esta pantalla, y es el correcto: crítico y accionable (§5.3). */
    await expect(c.getByRole("alert")).toBeInTheDocument();
    await expect(c.queryByText(/No podemos decirte/)).not.toBeInTheDocument();
  },
};

/* EL CASO QUE SE ESCAPABA. `covers_critical` es OPCIONAL en el contrato, así que un payload
   sin la clave no matcheaba `=== null` y volvía el silencio — el bug exacto que este trabajo
   viene a arreglar, entrando por la puerta de atrás. */
export const ClaveAusente: Story = {
  name: "Sin la clave en el payload (undefined)",
  args: {
    data: { ...base, covers_critical: undefined as unknown as null },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No podemos decirte si la caja alcanza/)).toBeInTheDocument();
  },
};

export const SinProyeccionDeCaja: Story = {
  name: "Sin proyección de caja (la tercera causa)",
  args: {
    data: {
      ...base,
      undated_amount: "0",
      undated_count: 0,
      missing_sources: [],
      projected_cash_14d: null,
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No podemos decirte si la caja alcanza/)).toBeInTheDocument();
    await expect(c.getByText(/proyectar tu caja a 14 días/)).toBeInTheDocument();
  },
};
