import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, fn, userEvent, waitFor } from "storybook/test";
import { PresupuestoV09View } from "./presupuesto-v09-view";
import {
  PERIODO,
  RESULT_OPERATIONAL_RESULT_DIVERGENTE,
  budgetByAccount,
  budgetByAccountVacio,
  budgetVsActual,
  budgetVsActualIncompleto,
  budgetVsActualSinDesvios,
  budgetVsActualSinPresupuesto,
  closingProjectionAbstiene,
  closingProjectionDisponible,
} from "./presupuesto-v09-fixtures";
import { documentosServicioMensual } from "@/components/gestion/v08/gestion-v08-fixtures";
import { buildBudgetGrid } from "../budget-grid-model";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { SOLO_TEST_STORYBOOK } from "@/test/storybook/solo-test-storybook";
import type { BudgetGridResponse } from "@/lib/api/planning";

/* V09 · Presupuesto — "¿cómo vas contra tu plan?" en sus estados (ESPECIFICACION §V09, issue #74).
 * Corren en Chromium headless como gate (`npm run test:storybook`).
 *
 * Lo que se fija acá: Ley 2 se CUENTA (cero elementos con token rojo, en TODOS los estados — esta
 * pantalla usa verde/ámbar para el desvío, nunca rojo) y — la parte que decide el pase — Ley 7
 * medida a 360, 346 y 320 px con reflow REAL de ventana y el detector correcto de la tabla
 * (`tabla.parentElement`, no el wrapper). La lógica pura vive en `presupuesto-v09-model.test.ts` y
 * el HTML estático (incluida la concordancia N=1) en `presupuesto-v09-view.test.tsx`. */

const PERIODO_LABEL = formatPeriodLabel(PERIODO);

/** Fixture mínimo de la grilla anual (mismo shape que `budget-grid-model.test.ts`) para la story
 *  del panel "Ajustar plan" — reusa `BudgetGridView`/`buildBudgetGrid`, nunca un cálculo nuevo. */
const GRID_FIXTURE: BudgetGridResponse = {
  year: 2026,
  currency: "CLP",
  status: "draft",
  accepted: false,
  has_budget: true,
  is_template: false,
  total_year: "0",
  generated_at: "2026-08-01T00:00:00Z",
  categories: [
    {
      account_id: "a1",
      account_code: "4.1",
      account_name: "Ventas",
      impact_type: "revenue",
      months: { "1": "10000000", "2": "12000000" },
      total_year: "22000000",
    },
  ],
};

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

function texto(canvasElement: HTMLElement): string {
  return (canvasElement.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* Ley 7 — detector compartido (mismo patrón que `administracion-v12-view.stories.tsx` /
 * `remuneraciones-v16-view.stories.tsx`, hallazgo de revisión: `test-storybook` corre en Linux —
 * fuentes más anchas que Windows — así que la medición LOCAL nunca es evidencia sobre el runner
 * que de verdad decide el gate. Por eso:
 *
 *   (1) Reflow REAL de ventana (`page.viewport`), no un decorator de ancho fijo — el decorator no
 *       cambia `document.documentElement`, así que nada obliga a que el texto reflowee como en una
 *       pantalla angosta real.
 *   (2) Control anti-medición-hueca: se espera a que el viewport quede REALMENTE en el ancho
 *       pedido antes de confiar en cualquier medición.
 *   (3) `scroller = tabla.parentElement` — el `div.overflow-y-auto` de `table.tsx` que scrollea de
 *       verdad —, NUNCA el wrapper `overflow-hidden` de más afuera (ese informa desborde 0
 *       SIEMPRE: con un eje en `auto` el otro computa `auto` y el hijo se come el desborde).
 *   (4) Control POSITIVO del detector, medido en cada corrida: se inyecta una sonda de 9999 px
 *       DENTRO del mismo scroller, se confirma que la fórmula la marca como desborde, y se limpia
 *       ANTES de la medición real — así un detector roto no puede dar un falso verde por
 *       casualidad. */
async function medirLey7SinDesborde(canvasElement: HTMLElement, ancho: number): Promise<void> {
  const { page } = await import("@vitest/browser/context");
  await page.viewport(ancho, 900);
  try {
    await waitFor(() => expect(document.documentElement.clientWidth).toBe(ancho));

    const tabla = canvasElement.querySelector<HTMLElement>("table")!;
    const scroller = tabla.parentElement!;

    const sonda = document.createElement("div");
    sonda.setAttribute("data-sonda-ley7", "");
    sonda.style.cssText = "width:9999px;height:1px;";
    scroller.appendChild(sonda);
    try {
      await waitFor(() => {
        expect(scroller.scrollWidth - scroller.clientWidth).toBeGreaterThan(0);
      });
    } finally {
      sonda.remove();
    }

    await waitFor(() => {
      expect(scroller.scrollWidth - scroller.clientWidth).toBeLessThanOrEqual(0);
    });

    /* Dato primario (Ley 7): el concepto de CADA fila no trunca, y el monto del desvío entra
       completo dentro del contenedor — nunca colapsa (a diferencia del pill de apoyo, que sí). */
    const canvas = within(canvasElement);
    for (const label of ["Ingresos", "Costo directo", "Gastos operacionales"]) {
      const nodo = canvas.getByText(label);
      expect(nodo.className).not.toContain("truncate");
      expect(nodo.scrollWidth).toBeLessThanOrEqual(nodo.clientWidth + 1);
    }
    const borde = canvasElement.getBoundingClientRect().right;
    for (const monto of ["+$2.500.000", "−$1.400.000", "+$800.000"]) {
      const celda = canvas.getByText(monto);
      expect(celda.getBoundingClientRect().right).toBeLessThanOrEqual(borde + 1);
    }
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V09 Presupuesto",
  component: PresupuestoV09View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V09 · Presupuesto (ESPECIFICACION §V09, issue #74/#101): tríada Plan/Real/Desvío + tabla de desvíos por concepto sobre `GET /api/planning/budget-vs-actual` · `variance`/`variance_pct` YA calculados por el backend, nunca recalculados en el front (Ley 1). INV-FIN-001: el "Real" de acá es el MISMO número que el "Resultado" de V08. Drill-down concepto→cuentas→documentos (MISMA interacción de V08, decisión BO 2026-09-20) + banner de proyección de cierre autoritativo del servidor (CC-API #431) con CTA "Ajustar plan" sobre la grilla anual ya existente. Flag `presupuestoV09`, apagado por defecto.',
      },
    },
  },
  args: {
    periodoLabel: PERIODO_LABEL,
    bva: budgetVsActual(),
    issueSucesor: "#101",
    onReintentar: fn(),
    onProponer: fn(),
    porCuenta: budgetByAccount(),
    onReintentarPorCuenta: fn(),
    onAbrirConcepto: fn(),
    onAbrirCuenta: fn(),
    proyeccion: closingProjectionDisponible(),
    onReintentarProyeccion: fn(),
    onToggleAjustarPlan: fn(),
  },
} satisfies Meta<typeof PresupuestoV09View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · tríada + tabla de desvíos, cero rojo",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$9.000.000")).toBeInTheDocument(); // Plan (result)
    await expect(canvas.getByText("$10.900.000")).toBeInTheDocument(); // Real (result)
    await expect(canvas.getByText(/a favor · 21,1%/)).toBeInTheDocument();
    // Tabla de desvíos: peor primero.
    await expect(canvas.getByText("Costo directo")).toBeInTheDocument();
    await expect(canvas.getByText("Ingresos")).toBeInTheDocument();
    await expect(canvas.getByText("Gastos operacionales")).toBeInTheDocument();
    // Bucket "Sin asignar / conflicto": fijo, fuera de cualquier concepto.
    await expect(canvas.getByText("Sin asignar / conflicto")).toBeInTheDocument();
    // Proyección de cierre, autoritativa del servidor.
    await expect(canvas.getByText("$118.000.000")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Ajustar plan" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
    // Huecos declarados (lo que SIGUE sin resolver), visibles en pantalla.
    expect(texto(canvasElement)).toContain("cuentas sin código");
    expect(texto(canvasElement)).not.toContain("issue sucesor");
  },
};

export const DrillConceptoACuentas: Story = {
  name: "Drill-down nivel 1 · click en un concepto abre sus cuentas (Ley 1, misma interacción de V08)",
  args: {
    // Sin `onAbrirConcepto`: la vista cae a su estado interno, así el click abre de verdad
    // (en el camino vivo `presupuesto-v09-live.tsx` SÍ lo controla, igual que `cuentaAbierta`).
    onAbrirConcepto: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filaIngresos = canvas.getByText("Ingresos").closest("tr")!;
    await userEvent.click(filaIngresos);
    // Las DOS cuentas `assigned` a "revenue" del fixture.
    await expect(canvas.getByText("Ventas Chile")).toBeInTheDocument();
    await expect(canvas.getByText("Ventas Exportación")).toBeInTheDocument();
    // Cross-foot: declarado con su propio copy, nunca un "descuadra" rojo.
    await expect(canvas.getByText(/bases contables distintas, no un error/)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const DrillCuentaADocumentos: Story = {
  name: "Drill-down nivel 2 · click en una cuenta abre sus documentos (reusa resolverDrill de V08)",
  args: {
    conceptoAbierto: "revenue",
    porCuenta: budgetByAccount({
      accounts: [
        {
          account_id: "op-1",
          account_code: "operating_income.service_monthly",
          account_name: "Servicio mensual",
          budget: "10000000",
          actual: "11000000",
          variance: "1000000",
          variance_pct: "10",
          concept: "revenue",
          concept_status: "assigned",
        },
      ],
    }),
    cuentaAbierta: {
      accountCode: "operating_income.service_monthly",
      accountName: "Servicio mensual",
    },
    documentos: documentosServicioMensual(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/FAC 435/)).toBeInTheDocument();
    await expect(canvas.getByText(/Comercial Kaufmann/)).toBeInTheDocument();
    await expect(
      canvas.getByText(/3 documentos · suman \$14\.616\.879/),
    ).toBeInTheDocument();
    // El click en la fila de la cuenta es lo que dispara la consulta de documentos (controlado).
    const filaCuenta = canvas.getByText("Servicio mensual").closest("tr")!;
    await userEvent.click(filaCuenta);
    await expect(args.onAbrirCuenta).toHaveBeenCalledWith(null); // ya estaba abierta → la cierra
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinAsignarVacio: Story = {
  name: "Bucket 'Sin asignar' no aparece cuando budget-by-account no trae cuentas",
  args: { porCuenta: budgetByAccountVacio() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText("Sin asignar / conflicto")).not.toBeInTheDocument();
  },
};

export const ProyeccionAbstiene: Story = {
  name: "Proyección de cierre · abstención explícita, nunca un 0 (Ley 3)",
  args: { proyeccion: closingProjectionAbstiene() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Todavía no podemos cerrar el año/)).toBeInTheDocument();
    await expect(
      canvas.getByText(/julio de 2026 todavía no tiene el resultado operacional cerrado/i),
    ).toBeInTheDocument();
    expect(texto(canvasElement)).not.toContain("$0");
    await expect(rojos(canvasElement)).toHaveLength(0); // ámbar, no rojo (Ley 2)
  },
};

export const AjustarPlanAbierto: Story = {
  name: "CTA 'Ajustar plan' · abre la grilla anual YA existente, integrada en esta pantalla",
  args: {
    ajustarPlanAbierto: true,
    grid: buildBudgetGrid(GRID_FIXTURE),
    onEditarCeldaGrid: fn(),
    onAceptarGrid: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Cerrar ajuste" })).toBeInTheDocument();
    // La grilla trae las cuentas del fixture (mismo componente `BudgetGridView` de Presupuesto F1a).
    await expect(canvas.getByText("Ventas")).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinPresupuesto: Story = {
  name: "Sin presupuesto del período · estado vacío honesto, con acción",
  args: { bva: budgetVsActualSinPresupuesto() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Todavía no tienes presupuesto/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Proponer presupuesto" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const DatoIncompleto: Story = {
  name: "Dato incompleto · declara la fuente faltante, no la esconde",
  args: { bva: budgetVsActualIncompleto() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Dato parcial/i)).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("Revisa el detalle de conexiones");
    expect(texto(canvasElement)).not.toContain("sii_rcv");
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinDesvios: Story = {
  name: "Sin desvíos · 'clavado al plan', tabla no queda vacía muda",
  args: { bva: budgetVsActualSinDesvios() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/clavado al plan/i)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const ErrorDeConexion: Story = {
  name: "Error · la fuente no respondió, con Reintentar",
  args: { bva: undefined, error: "No pudimos conectar con Planificación (error de red)." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No pudimos consultar el presupuesto/)).toBeInTheDocument();
    expect(texto(canvasElement)).not.toContain("error de red");
    await expect(canvas.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const InvarianteRoto: Story = {
  name: "INV-FIN-001 roto · declara Real y Resultado, ninguno se elige en silencio (Ley 1)",
  args: { resultOperacional: RESULT_OPERATIONAL_RESULT_DIVERGENTE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/no coincide con el/i)).toBeInTheDocument();
    // El Real que la tríada pinta (budget-vs-actual, sin cambiar) Y el Resultado declarado
    // (operational-result) — los DOS números en pantalla, no uno elegido en silencio.
    await expect(canvas.getByText("$10.900.000")).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("$9.000.000");
    await expect(rojos(canvasElement)).toHaveLength(0); // ámbar, no rojo (Ley 2)
  },
};

/* ────────────────────────── Ley 7 · tres mediciones ────────────────────────── */

/** El mínimo que pide la spec (§5.2): sin scroll horizontal de página en ≥ 360 px. */
export const Ley7Angosto360: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 360 px · la tabla entra completa, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 360);
  },
};

/** Margen de fuente adoptado por el rediseño (`gestion-v08`/`administracion-v12`): 346 px = 360
 *  con la holgura Linux/Windows medida en esas vistas — la que de verdad decide si el gate de CI
 *  (Linux) va a pasar. */
export const Ley7Angosto346: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 346 px · margen de fuente (= 360, holgura Linux/Windows)",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 346);
  },
};

/** Ancho de teléfono más angosto habitual — la columna del pill (`hideBelowTable: "sm"`) colapsa
 *  acá; el concepto y el monto del desvío (dato primario) siguen enteros. */
export const Ley7Angosto320: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 320 px · ancho de teléfono, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 320);
  },
};
