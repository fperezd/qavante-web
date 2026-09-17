import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, fn, userEvent } from "storybook/test";
import { formatClp } from "@/lib/formatters/clp";
import { saldoCajaHoy } from "@/lib/finanzas/caja-hoy";
import { CajaV02View } from "./caja-v02-view";
import {
  HOY,
  PROYECCION_BAJO_CERO,
  cobranza,
  pagos,
  proyeccion,
  sinClasificar,
  summary,
} from "./caja-v02-fixtures";

/* V02 · Caja — "¿me alcanza la caja?", en sus estados.
 *
 * Corren en Chromium headless como gate (`npm run test:storybook`). Lo que se fija acá se fija
 * sobre el DOM renderizado: la Ley 2 se CUENTA (elementos con token rojo), no se promete. Cada
 * negativo lleva su gemelo positivo con la misma query. La lógica pura y la Ley 1 con sentinel
 * viven en `caja-v02-model.test.ts` y `caja-v02-view.test.tsx`. */

/** La tríada KPI: el saldo de hoy se busca AHÍ, porque el mismo número puede repetirse abajo
 *  (con una proyección plana, el punto más bajo ES el saldo de hoy). */
function triada(canvasElement: HTMLElement) {
  return within(canvasElement.querySelector('[aria-label="Hoy, entra y sale"]') as HTMLElement);
}

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

const meta = {
  title: "Rediseño F2 / V02 Caja",
  component: CajaV02View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V02 · Caja (ESPECIFICACION §V02): tríada KPI (Hoy con chip banco+hora ✓ / Entra 14d / Sale 14d con su agregado no postergable del servidor), banner de deuda de datos, barras de 4 semanas con "¿cómo se calcula?", tabla "Qué te lleva al punto más bajo" y footer con exclusiones. Postergar usa sólo el UUID publicado por la causa y tiene una ventana cancelable.',
      },
    },
  },
  args: {
    summary: summary(),
    proyeccion: proyeccion(),
    cobranza: cobranza(),
    pagos: pagos(),
    sinClasificar: sinClasificar({ count: 0, inflowByCurrency: [] }),
    bancos: ["BICE"],
    onPostpone: fn(),
    hoy: HOY,
  },
} satisfies Meta<typeof CajaV02View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · la caja aguanta, nada bajo cero",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kpis = triada(canvasElement);
    await expect(kpis.getByText("$9.800.000")).toBeInTheDocument();
    await expect(kpis.getByText(/BICE · \d{2}:\d{2} ✓/)).toBeInTheDocument();
    await expect(canvas.getByText("+$14.498.964")).toBeInTheDocument();
    await expect(canvas.getByText("−$35.532.396")).toBeInTheDocument();
    await expect(canvas.getByText(/\$7\.574\.979 críticos · 2 pagos críticos/)).toBeInTheDocument();
    // 4 barras, ninguna en rojo.
    await expect(
      canvasElement.querySelectorAll('[aria-label="Neto por semana"] > li'),
    ).toHaveLength(4);
    await expect(rojos(canvasElement)).toHaveLength(0);
    await expect(
      canvas.getByRole("heading", { name: /Qué te lleva al punto más bajo/ }),
    ).toBeInTheDocument();
    await expect(canvas.queryByText(/exclusiones para tu empresa/)).not.toBeInTheDocument();
  },
};

export const BajoCero: Story = {
  name: "Bajo cero · el mínimo es el único rojo de la pantalla",
  args: {
    proyeccion: PROYECCION_BAJO_CERO,
    summary: summary({
      cash_today: {
        total: "5078750",
        last_updated: "2026-08-30T08:12:00Z",
        data_state: "available",
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Ley 2: hay rojo (crítico Y accionable: hay pagos que mover) y es UNO: la barra de la semana
       del punto más bajo. */
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!.getAttribute("data-piso")).toBe("true");
    // El piso con su fecha y su monto (menos tipográfico), en tinta, no en rojo.
    await expect(
      canvas.getByRole("heading", {
        name: /Qué te lleva al punto más bajo · 7 sep · −\$1\.121\.250/,
      }),
    ).toBeInTheDocument();
    // Las causas del quiebre, con su acción por fila.
    await expect(canvas.getByText("Tradolarpeso")).toBeInTheDocument();
    await expect(canvas.getByText("−$674.473")).toBeInTheDocument();
    await expect(canvas.getAllByRole("link", { name: "Pagar" }).length).toBe(4);
    // Ley 9: el F29 dice que no se posterga; el vencido va en ámbar (no rojo).
    await expect(canvas.getByText("No se posterga")).toBeInTheDocument();
    await expect(canvas.getByText("Vencido")).toBeInTheDocument();
    // Sólo las causas con UUID seguro ofrecen Postergar; F29 no y la Ley 2 sigue en un rojo.
    await expect(canvas.getAllByRole("button", { name: /^Postergar/ })).toHaveLength(3);
    await expect(canvas.queryByText(/No cuenta \$39\.600\.000/)).not.toBeInTheDocument();
  },
};

export const PostergarCancelable: Story = {
  name: "Postergar · Ley 4: la cuenta se ve y Cancelar no llama la API",
  args: {
    proyeccion: PROYECCION_BAJO_CERO,
    onPostpone: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // El glifo decorativo de la primera etiqueta depende de la codificación del runner;
    // el prefijo semántico estable es la accesibilidad que importa aquí.
    await userEvent.click(canvas.getAllByRole("button", { name: /^Postergar/ })[0]!);
    await userEvent.click(canvas.getByRole("button", { name: /^7 d/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Postergaremos");
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await expect(args.onPostpone).not.toHaveBeenCalled();
  },
};

export const SinSaldoBase: Story = {
  name: 'Sin saldo base · el "no sé" es explícito, sin curva desde $0',
  args: { summary: summary({ cash_today: null }), proyeccion: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("sin dato").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Conecta tu banco para ver tu saldo real")).toBeInTheDocument();
    // Gemelo del negativo: el saldo que SÍ existe en "Normal" no está acá.
    await expect(canvas.queryByText("$9.800.000")).not.toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    // Los flujos conocidos se siguen mostrando.
    await expect(canvas.getByText("+$14.498.964")).toBeInTheDocument();
    await expect(canvas.getByText("−$35.532.396")).toBeInTheDocument();
    // Sin barras ni piso: el estado habla y ofrece qué hacer.
    await expect(
      canvas.getByText("No pudimos consultar la proyección de caja"),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar conexiones" })).toBeInTheDocument();
    await expect(canvas.queryByText(/Qué te lleva al punto más bajo/)).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinClasificar: Story = {
  name: "Calidad del dato > 0 · aviso secundario de auditoría",
  args: { sinClasificar: sinClasificar() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("note")).toHaveTextContent("3 movimientos pendientes");
    await expect(canvas.getByRole("link", { name: "Revisar" })).toHaveAttribute("href", "/bandeja");
    await expect(triada(canvasElement).getByText("$9.800.000")).toBeInTheDocument();
    // Un aviso administrativo es ámbar/neutro, nunca rojo (Ley 2).
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinClasificarError: Story = {
  name: "Calidad del dato en error · la lectura financiera no desaparece",
  args: { sinClasificar: sinClasificar({ isError: true, count: 0, inflowByCurrency: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("note")).toHaveTextContent("Faltan movimientos del banco.");
    await expect(triada(canvasElement).getByText("$9.800.000")).toBeInTheDocument();
    // Sigue siendo un aviso administrativo: ámbar/neutro, nunca rojo (Ley 2).
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Vacio: Story = {
  name: "Vacío · sin ninguna fuente, cada tarjeta dice qué falta",
  args: {
    summary: null,
    proyeccion: null,
    cobranza: null,
    pagos: null,
    sinClasificar: null,
    bancos: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("sin dato")).toHaveLength(3);
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/exclusiones/)).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Ley1MismoSaldoQueHoy: Story = {
  name: "Ley 1 · el saldo es el de cajaHoy(), el mismo que V01",
  play: async ({ canvasElement, args }) => {
    /* El número que la tríada RENDERIZA se compara contra el que sale de `saldoCajaHoy`, la
       misma función que resuelve V01. El sentinel que prueba que la vista no desarma
       `cash_today` por su cuenta vive en `caja-v02-view.test.tsx` (vi.mock). */
    const esperado = formatClp(saldoCajaHoy(args.summary)!);
    await expect(esperado).toBe("$9.800.000"); // el positivo no puede pasar por vacío
    await expect(triada(canvasElement).getByText(esperado)).toBeInTheDocument();
    await expect(triada(canvasElement).getByText("Hoy")).toBeInTheDocument();
  },
};

export const ComoSeCalcula: Story = {
  name: "Lectura directa · sin explicación técnica desplegable",
  args: { proyeccion: PROYECCION_BAJO_CERO },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: /¿Cómo se calcula\?/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText(/Saldo proyectado al cierre de cada día/),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText(/Qué te lleva al punto más bajo/)).toBeInTheDocument();
  },
};
