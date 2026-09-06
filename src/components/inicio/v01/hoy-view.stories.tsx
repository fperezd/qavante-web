import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { formatClp } from "@/lib/formatters/clp";
import { saldoCajaHoy } from "@/lib/finanzas/caja-hoy";
import { HoyView } from "./hoy-view";
import type { CashGapProposal } from "./cash-gap-proposal-model";
import { instrumentDecisionStoryLayer } from "./instrument-decision.fixtures";

/* V01 · Hoy · la portada del rediseño, en sus cinco estados.
 *
 * Las stories fijan la composición visible y las interacciones en Chromium. Los modelos puros
 * tienen tests unitarios separados para que una propuesta no pueda aparecer sin una decisión
 * lista y recomendada por el backend.
 *
 * La sección 5 usa la bitácora real de Ley 5 (`/api/reversible-actions`); la historia de ella vive
 * junto a su componente para fijar carga, error, vacío y acciones deshacibles. */

const HOY = new Date("2026-08-30T12:00:00Z");

function summary(over: Partial<DashboardSummaryV2> = {}): DashboardSummaryV2 {
  return {
    executive_phrase: null,
    pulso: null,
    cash_today: {
      total: "9800000",
      last_updated: "2026-08-30T08:00:00Z",
      data_state: "available",
    },
    cash_forecast: {
      min_14d: "4200000",
      min_30d: "3100000",
      days_of_cash: 96,
      last_updated: "2026-08-30T08:00:00Z",
      source: "banco",
    },
    cash_gap: {
      critical_obligations_14d: "0",
      projected_cash_14d: "4200000",
      cash_gap_amount_14d: "0",
      has_gap: false,
      last_updated: "2026-08-30T08:00:00Z",
      source: "banco",
    },
    overdue_collections: {
      total_receivable: "18500000",
      overdue: "7200000",
      top_clients: [],
      last_updated: "2026-08-30T08:00:00Z",
      source: "sii_rcv",
    },
    critical_payments: null,
    operational_result: {
      revenue: "42000000",
      gross_margin: "16800000",
      ebitda_proxy: "5100000",
      result: "3900000",
      last_updated: "2026-08-30T08:00:00Z",
      source: "sii_rcv",
    },
    priority_actions: [],
    ...over,
  } as DashboardSummaryV2;
}

const ACCION = (priority: number, reason: string, cta_href = "/cobrar") => ({
  priority,
  reason,
  deadline: "5 días",
  cta_label: "Ir al módulo",
  cta_href,
  amount: "2500000",
  impact_label: "de impacto en caja",
});

const CAJA_BAJO_CERO: Partial<DashboardSummaryV2> = {
  cash_forecast: {
    min_14d: "-1121250",
    min_30d: "-3400000",
    days_of_cash: 0,
    last_updated: "2026-08-30T08:00:00Z",
    source: "banco",
  },
  cash_gap: {
    critical_obligations_14d: "7400000",
    projected_cash_14d: "-1121250",
    cash_gap_amount_14d: "1121250",
    has_gap: true,
    last_updated: "2026-08-30T08:00:00Z",
    source: "banco",
  },
};

const PROPUESTA_PAGOS: CashGapProposal = {
  kind: "payment_plan",
  label: "Negociar pagos críticos",
  explanation: "El plan publicado permite revisar primero los pagos que explican la brecha.",
  confidence: "medium",
  evidenceCount: 2,
  targets: [{ label: "Remuneraciones de agosto", amount: "7400000", reason: "vence primero" }],
  impacts: [
    {
      metric: "cash_gap_14d",
      value: "1121250",
      currency: "CLP",
      horizon_days: 14,
      confidence: "medium",
      confidence_method: "evidence_bounded",
    },
  ],
  href: "/pagar",
  cta: "Revisar pagos propuestos",
};

/** Ley 2 — los elementos con token de rojo que hay en pantalla. */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="danger-"]'));
}

const meta = {
  title: "Rediseño F2 / V01 Hoy",
  component: HoyView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V01 · Hoy (ESPECIFICACION §V01): crumb con frescura del banco, titular-veredicto {sana | atención | crisis | sin dato}, subtítulo de contexto, "Esperando tu visto bueno" (máx. 3), bitácora de automatismos con Deshacer y strip de 4 indicadores.',
      },
    },
  },
  args: { empresa: "Tooxs Digital SpA", hoy: HOY },
} satisfies Meta<typeof HoyView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sana: Story = {
  name: "Sana · la caja aguanta, hay cosas que aprobar",
  args: {
    data: summary({
      priority_actions: [ACCION(1, "Cobrar a Kaufmann"), ACCION(2, "Pagar el F29", "/impuestos")],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Tu empresa está sana" })).toBeInTheDocument();
    await expect(canvas.getByText("hay 2 cosas que necesitan tu OK")).toBeInTheDocument();
    await expect(canvas.getByText("Esperando tu visto bueno")).toBeInTheDocument();
    await expect(canvas.getByText("Cobrar a Kaufmann")).toBeInTheDocument();
    await expect(
      canvas.queryByRole("heading", { name: "Instrumentos en evaluación" }),
    ).not.toBeInTheDocument();
    // Ley 2: una pantalla sana no tiene NINGÚN rojo...
    await expect(rojos(canvasElement)).toHaveLength(0);
    // ...y el gemelo positivo, para que ese cero no pase por una query que no casa nunca:
    // el veredicto verde SÍ está pintado.
    await expect(canvasElement.querySelectorAll('[class*="success-"]').length).toBeGreaterThan(0);
  },
};

export const Atencion: Story = {
  name: "Atención · la caja cruza el cero a 14 días",
  args: {
    data: summary({
      ...CAJA_BAJO_CERO,
      priority_actions: [ACCION(1, "Cobrar a Kaufmann"), ACCION(2, "Postergar a SYNNEX", "/pagar")],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Tu caja necesita atención" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("En los próximos 14 días tu caja llega a −$1.121.250."),
    ).toBeInTheDocument();
    /* Ley 2: "atención" es ÁMBAR, no rojo. El rojo se reserva para lo crítico Y accionable. */
    await expect(rojos(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('[class*="warning-"]').length).toBeGreaterThan(0);
    // Y NO es el titular de crisis (gemelo del positivo de la story de crisis).
    await expect(canvas.queryByText("Tus sueldos están en riesgo")).not.toBeInTheDocument();
  },
};

export const Crisis: Story = {
  name: "Crisis · sueldos en riesgo: menos interfaz, no más rojo",
  args: {
    data: summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        due_7d: "7400000",
        due_14d: "7400000",
        next_critical: {
          label: "Proveedor próximo",
          due_date: "2026-09-04",
          amount: "7400000",
          category: "supplier",
          is_overdue: false,
        },
        next_payroll: {
          label: "Remuneraciones de agosto",
          due_date: "2026-09-04",
          amount: "7400000",
          category: "payroll",
          is_overdue: false,
        },
        last_updated: "2026-08-30T08:00:00Z",
        source: "buk",
      },
      priority_actions: [
        ACCION(1, "Conseguir $1.121.250 antes del 4 de septiembre", "/caja"),
        ACCION(2, "Cobrar a Kaufmann"),
        ACCION(3, "Postergar a SYNNEX", "/pagar"),
      ],
    }),
    cashGapProposals: [PROPUESTA_PAGOS],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Tus sueldos están en riesgo" }),
    ).toBeInTheDocument();

    // Ley 10: la alerta crítica se convierte en una propuesta del backend, no en una lista
    // de acciones genéricas del summary.
    await expect(canvas.getByText("Propuesta para proteger tu caja")).toBeInTheDocument();
    await expect(canvas.getByText("Negociar pagos críticos")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar pagos propuestos" })).toHaveAttribute(
      "href",
      "/pagar",
    );
    await expect(canvas.queryByText("Esperando tu visto bueno")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Conseguir $1.121.250 antes del 4 de septiembre"),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("Cobrar a Kaufmann")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Postergar a SYNNEX")).not.toBeInTheDocument();

    // La única prioridad no queda como un enlace abstracto a la proyección: publica la nómina
    // que causa la crisis y ofrece el módulo existente para revisar pagos.
    await expect(canvas.getByText("Nómina afectada")).toBeInTheDocument();
    await expect(canvas.getByText(/Remuneraciones de agosto · vence 4 sep/)).toBeInTheDocument();
    await expect(canvas.getByText("$7.400.000")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar pagos" })).toHaveAttribute(
      "href",
      "/pagar",
    );

    // Ley 10: el strip de indicadores también se oculta. Gemelo positivo del negativo:
    // el MISMO texto SÍ aparece en la story "Sana", donde el strip se muestra.
    await expect(canvas.queryByText("Value Ledger")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Te deben")).not.toBeInTheDocument();

    /* Ley 2 — máximo UN rojo: hay rojo (es crítico y accionable) y vive ENTERO dentro del
       veredicto. Ninguna otra zona de la pantalla lo repite. */
    const marcados = rojos(canvasElement);
    await expect(marcados.length).toBeGreaterThan(0);
    const veredicto = canvasElement.querySelector('section[aria-labelledby="hoy-titular"]')!;
    await expect(marcados.every((el) => veredicto.contains(el))).toBe(true);
  },
};

/** Fixture de respuesta incompleta: el contrato declara `amount` como string, pero la vista
 * debe seguir siendo honesta ante `null` de una integración incompleta. */
function nominaConMontoIncompleto(amount: string | null) {
  return {
    label: "Remuneraciones sin monto informado",
    due_date: "2026-09-04",
    amount,
    category: "payroll",
    is_overdue: false,
  } as unknown as NonNullable<NonNullable<DashboardSummaryV2["critical_payments"]>["next_payroll"]>;
}

function crisisSinMontoNomina(name: string, amount: string | null): Story {
  return {
    name,
    args: {
      data: summary({
        ...CAJA_BAJO_CERO,
        critical_payments: {
          due_7d: "0",
          due_14d: "0",
          next_critical: null,
          next_payroll: nominaConMontoIncompleto(amount),
          last_updated: "2026-08-30T08:00:00Z",
          source: "buk",
        },
        priority_actions: [ACCION(1, "Revisar la caja antes de la nómina", "/caja")],
      }),
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const bloqueNomina = canvas.getByText("Nómina afectada").parentElement!;
      await expect(
        within(bloqueNomina).getByText(/Remuneraciones sin monto informado · vence 4 sep/),
      ).toBeInTheDocument();
      // Gemelo positivo: la story Crisis de arriba sí fija el monto válido publicado.
      await expect(within(bloqueNomina).queryByText(/\$0/)).not.toBeInTheDocument();
      await expect(
        within(bloqueNomina).getByRole("link", { name: "Revisar pagos" }),
      ).toHaveAttribute("href", "/pagar");
    },
  };
}

export const CrisisMontoNominaNulo = crisisSinMontoNomina(
  "Crisis · nómina con monto nulo: no inventa $0",
  null,
);

export const CrisisMontoNominaVacio = crisisSinMontoNomina(
  "Crisis · nómina con monto vacío: no inventa $0",
  "",
);

export const CrisisMontoNominaBlanco = crisisSinMontoNomina(
  "Crisis · nómina con monto blanco: no inventa $0",
  "   ",
);

export const CrisisMontoNominaNoNumerico = crisisSinMontoNomina(
  "Crisis · nómina con monto no numérico: no inventa $0",
  "no disponible",
);

export const DiaPerfecto: Story = {
  name: "Día perfecto · no hay nada que aprobar",
  args: { data: summary({ priority_actions: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "No hay nada que necesite tu OK" }),
    ).toBeInTheDocument();
    // Sin cosas que aprobar, la sección no se abre vacía para desmentir al titular.
    await expect(canvas.queryByText("Esperando tu visto bueno")).not.toBeInTheDocument();
    // Gemelo positivo del negativo de arriba: en "Sana" ese MISMO texto sí está, y acá el
    // strip de indicadores —que sí se muestra en el día perfecto— también.
    await expect(canvas.getByText("Caja hoy")).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinDato: Story = {
  name: 'Sin dato · el "no sé" es un bucket explícito',
  args: { data: summary({ cash_today: null, cash_forecast: null, cash_gap: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Todavía no podemos darte un veredicto" }),
    ).toBeInTheDocument();
    /* `qavante-api#162` con otro sustantivo: la palabra tranquilizadora sobre un tenant del que
       no se sabe nada. Cada negativo con su gemelo positivo, misma cadena. */
    await expect(canvas.queryByText("Tu empresa está sana")).not.toBeInTheDocument();
    await expect(canvas.getByText("Banco sin dato de saldo")).toBeInTheDocument();
    await expect(
      canvas.getByText("Todavía no sabemos cuánta caja tienes: falta el saldo del banco."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Conecta tu banco para verlo")).toBeInTheDocument();
    // Ni verde ni rojo: neutro. Ninguno de los dos tonos de veredicto está en pantalla.
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Ley1MismoSaldoQueCaja: Story = {
  name: "Ley 1 · el saldo de hoy es el de /caja",
  args: { data: summary() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    /* El número que la pantalla RENDERIZA se compara contra el que sale de `saldoCajaHoy`, la
       misma función que resuelve el hero de `/caja`. Si alguien vuelve a desarmar `cash_today`
       en una de las dos pantallas, este assert es el que se cae.
       Antecedente: `qavante-api#102` — el Pulso decía 16 en Inicio y 32 en su pantalla propia. */
    const esperado = formatClp(saldoCajaHoy(args.data)!);
    await expect(esperado).toBe("$9.800.000"); // el negativo de abajo no puede pasar por vacío
    await expect(canvas.getByText(esperado)).toBeInTheDocument();
    await expect(canvas.getByText("Caja hoy")).toBeInTheDocument();
  },
};

export const ValueLedgerEnPreparacion: Story = {
  name: "Value Ledger · hueco declarado, no un número inventado",
  args: { data: summary() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Value Ledger")).toBeInTheDocument();
    await expect(canvas.getByText("En preparación · llega con la capa Piloto")).toBeInTheDocument();
    /* El indicador de al lado SÍ trae número: el "Sin dato" del Value Ledger no es un bug de
       render, es la ausencia declarada de un dato que no existe. */
    await expect(canvas.getByText("$9.800.000")).toBeInTheDocument();
  },
};

export const CapaComunF3F9Integrada: Story = {
  name: "F3–F9 · boundary puro integrado en Hoy",
  args: {
    data: summary(),
    decisionLayer: instrumentDecisionStoryLayer(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "No hay nada que necesite tu OK" }),
    ).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Instrumentos en evaluación" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Resultado y Value Ledger" })).toBeVisible();
    await expect(
      canvas.getByText("Integraciones externas deshabilitadas · sin envío ni ejecución"),
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
