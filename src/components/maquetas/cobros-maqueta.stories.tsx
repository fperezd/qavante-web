import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { CobrosMaqueta } from "./cobros-maqueta";
import { MaquetaAviso } from "./maqueta-aviso";
import { SOLO_TEST_STORYBOOK } from "@/test/storybook/solo-test-storybook";

/* Maqueta de Cobros (Constanza, `local/qavante-web-fintoc` → entró a main en web#370 bajo
 * `/maquetas/cobros`, detrás del flag `maquetasUx`). Esta story la trae a Storybook para que el
 * diseño se pueda revisar sin levantar la app ni prender el flag, y para que Chromatic avise
 * cuando cambie.
 *
 * Por qué ESTA primero, de las cuatro maquetas: es la que propone el arreglo de los tres
 * recuadros de Cobrar que web#371 acaba de resolver en la pantalla real, así que es la que más
 * se va a mirar al comparar diseño contra producto.
 *
 * COSTO EN CHROMATIC — el repo no define `modes`, así que cada story habilitada = 1 snapshot:
 *   · `Pendientes` ................ 1 snapshot (la única captura visual)
 *   · las tres `Ley7*` ............ 0 snapshots (`SOLO_TEST_STORYBOOK` ⇒ `chromatic.disable`)
 *   TOTAL: 1 snapshot. Deliberado: las vistas son grandes y la cuota es del repo entero, así que
 *   no se suben las tres vistas (pendientes/vencidos/cobrados) por separado — el cambio de vista
 *   es interacción, y lo cubre el `play` de `Pendientes` sin gastar otra captura.
 *
 * DÍA CONGELADO: la maqueta filtra los datos de ejemplo contra la fecha actual (su período por
 * defecto son los últimos 90 días). Sin congelar el día, la captura cambiaría sola cada mañana y
 * Chromatic pediría aprobar un diff que nadie causó. `HOY` cae dentro del rango de
 * `src/lib/demo/cash-flow-data.ts` (2026-07-01 … 2026-09-24) para que las tres vistas tengan
 * contenido de verdad y no se mida una pantalla vacía. */

/** Último día con movimientos de ejemplo + 1: los 90 días previos cubren TODA la data demo. */
const HOY = new Date(2026, 8, 25); // 2026-09-25 (mes 8 = septiembre)

const ANCHO_MINIMO = 360;
/* Misma holgura y por la misma razón que `gestion-v08-view.stories.tsx`: el runner de CI es
   Linux, con fuentes más anchas que Windows, así que una medición local a 360 en verde no dice
   nada sobre el gate. Medir en 346 es MÁS estricto que los 360 que pide la spec, no menos. */
const HOLGURA_FUENTE = 14;
const ANCHO_MEDIDO = ANCHO_MINIMO - HOLGURA_FUENTE;

/** Ley 7 / §5.2 — sin scroll horizontal DE PÁGINA en anchos de teléfono.
 *
 * Lo que esta medición afirma y lo que NO, dicho explícitamente porque acá el criterio de
 * `gestion-v08` no se puede copiar tal cual:
 *
 *   · El historial de cobros es una tabla `min-w-[1050px]` DENTRO de un `overflow-x-auto`. Que su
 *     borde derecho quede fuera de la ventana es el diseño funcionando, no un desborde: scrollea
 *     en su propio contenedor. Por eso acá NO se exige `table.right <= ancho` como en
 *     `gestion-v08` — ahí las tablas sí tenían que caber, y aplicar ese criterio tal cual haría
 *     fallar a esta story por una razón falsa.
 *   · Lo que sí se exige es (a) que la PÁGINA no scrollee en horizontal, y (b) que ningún
 *     contenedor scrolleable empiece más allá del borde — porque un scroller más ancho que la
 *     ventana sí empuja la página y es el modo de falla real de esta pantalla.
 *
 * Tres controles anti-medición-hueca, en el orden en que importan:
 *   (1) el viewport quedó REALMENTE en el ancho pedido (si el runner ignora `page.viewport`,
 *       mediríamos una ventana ancha y la story pasaría siempre);
 *   (2) control POSITIVO del detector medido en cada corrida: se inyecta una sonda de 9999 px,
 *       se confirma que la fórmula la marca, y se limpia ANTES de la medición real — un detector
 *       roto no puede dar verde por casualidad;
 *   (3) el fallo NOMBRA al culpable con su ancho, en vez de obligar a adivinar cuál bloque se salió.
 *
 * Se restaura el viewport al final para no contaminar las stories siguientes. */
async function medirLey7SinScrollDePagina(
  ancho: number,
  canvasElement: HTMLElement,
): Promise<void> {
  const { page } = await import("@vitest/browser/context");
  await page.viewport(ancho, 900);
  try {
    const doc = document.documentElement;
    await waitFor(() => expect(doc.clientWidth).toBe(ancho));

    /* (0) Esperar las FUENTES antes de medir, y esto no es precaución teórica: sin este await la
       medición da un falso VERDE. Medido en este repo — corriendo la story de 320 sola, el
       documento medía 320/320 (cero desborde) porque Sora todavía no había cargado y el texto se
       dibujaba con la fallback, más angosta; con las fuentes aplicadas el mismo layout pedía 343
       px. O sea que el orden de ejecución decidía si Ley 7 pasaba, que es justo lo que una
       medición no puede hacer. */
    await document.fonts.ready;

    const canvas = within(canvasElement);

    /* Se mide CADA vista, no sólo la de entrada. El historial de "Realizados" es el que trae la
       tabla `min-w-[1050px]`, o sea la parte con más chance de romper Ley 7: medir sólo la vista
       por defecto sería declarar la pantalla medida habiendo mirado la mitad más fácil. */
    for (const vista of ["Pendientes", "Vencidos", "Realizados"]) {
      canvas.getByRole("button", { name: vista }).click();
      await waitFor(() =>
        expect(canvas.getByRole("button", { name: vista })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );

      // Control POSITIVO del detector, medido en cada vuelta: una sonda de 9999 px TIENE que
      // marcarse como desborde. Así un detector roto no puede dar verde por casualidad.
      const sonda = document.createElement("div");
      sonda.style.cssText = "width:9999px;height:1px;";
      document.body.appendChild(sonda);
      try {
        await waitFor(() => expect(document.body.scrollWidth).toBeGreaterThan(ancho));
      } finally {
        sonda.remove();
      }

      await waitFor(() => {
        // La PÁGINA no scrollea en horizontal. Éste es el enunciado de Ley 7 §5.2.
        expect(doc.scrollWidth, `${vista} · documentElement`).toBeLessThanOrEqual(ancho);
        expect(document.body.scrollWidth, `${vista} · body`).toBeLessThanOrEqual(ancho);

        /* Y cada CONTENEDOR scrolleable entra en la ventana. Se mide el contenedor, nunca su
           contenido: la tabla del historial es `min-w-[1050px]` a propósito y scrollea dentro de
           su `overflow-x-auto`, así que exigirle a la TABLA que quepa —como hace
           `gestion-v08-view.stories.tsx`, donde las tablas sí tenían que caber— haría fallar esta
           story por una razón falsa. Lo que sí es un bug es un contenedor más ancho que la
           pantalla, porque ése empuja la página. 1 px de tolerancia por redondeo sub-pixel. */
        const fuera = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[class*='overflow-x-auto'], [class*='overflow-hidden']",
          ),
        )
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > ancho + 1))
          .map(
            ({ el, r }) =>
              `${el.tagName}.${String(el.className).slice(0, 60)}=[${Math.round(r.left)},${Math.round(r.right)}]`,
          );
        expect(fuera.join(" || "), `${vista} · contenedores fuera de la ventana`).toBe("");
      });
    }

    // Se vuelve a la vista de entrada para no dejarle otro estado a la story siguiente.
    canvas.getByRole("button", { name: "Pendientes" }).click();
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Maquetas / Cobros (diseño, cifras de ejemplo)",
  component: CobrosMaqueta,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Maqueta de diseño de Cobros (web#370, ruta `/maquetas/cobros` detrás del flag `maquetasUx`). TODAS las cifras son de ejemplo (`src/lib/demo/`): sirve para decidir cómo debería verse la pantalla, no para tomar una decisión de plata. El día está congelado en 2026-09-25 para que la captura no cambie sola con el paso del tiempo.",
      },
    },
  },
  args: { hoy: HOY },
  /* El aviso de maqueta va ARRIBA y antes de la primera cifra, igual que en la página real: una
     captura de esta story sin el aviso sería indistinguible de la caja de una empresa de verdad. */
  decorators: [
    (Story) => (
      <div className="space-y-5">
        <MaquetaAviso pantallaReal={{ href: "/cobrar", label: "Cobrar" }} />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CobrosMaqueta>;

export default meta;
type Story = StoryObj<typeof meta>;

/** La única captura visual. El `play` recorre las tres vistas por interacción, así que la
 *  cobertura de comportamiento no cuesta snapshots adicionales. */
export const Pendientes: Story = {
  name: "Cobros · las tres vistas por interacción (1 snapshot)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* El aviso es la condición para que tener esta maqueta dentro del producto sea honesto:
       si desaparece, la story tiene que fallar, no pasar más linda. */
    await expect(canvas.getByRole("note")).toHaveTextContent(
      /todas las cifras de esta pantalla son de ejemplo/i,
    );
    await expect(canvas.getByRole("link", { name: "Cobrar" })).toHaveAttribute("href", "/cobrar");

    /* Vista por defecto = Pendientes, y está marcada como tal (`aria-pressed`). Ojo con los
       rótulos: la tercera vista se llama "Realizados" en pantalla aunque su valor interno sea
       `cobrados`; el `play` usa el rótulo que lee el usuario. */
    await expect(canvas.getByRole("button", { name: "Pendientes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getByText("Ver cobros hasta")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Resumen de cobros pendientes")).toBeInTheDocument();

    /* Cada vista muestra algo PROPIO, nombrado: así la aserción cae si el switch no cambia nada
       o si cambia a la vista equivocada. Un `textContent !== antes` pelado pasaría con cualquier
       re-render, incluso el que no cambió de vista. */
    const marcaDeVista: Array<[string, string]> = [
      ["Vencidos", "Cobros vencidos"],
      ["Realizados", "Historial de cobros"],
    ];
    for (const [rotulo, marca] of marcaDeVista) {
      canvas.getByRole("button", { name: rotulo }).click();
      /* Por rol de encabezado, no por texto: "Cobros vencidos" aparece DOS veces en esa vista
         (el rótulo de una tarjeta de resumen y el `h2` de la sección), y `getByText` reventaría
         por múltiples coincidencias en vez de medir lo que queremos. */
      await waitFor(() =>
        expect(canvas.getByRole("heading", { name: marca })).toBeInTheDocument(),
      );
      await expect(canvas.getByRole("button", { name: rotulo })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      // Gemelo negativo: al entrar a esta vista, la marca de Pendientes ya NO está.
      await expect(canvas.queryByText("Ver cobros hasta")).not.toBeInTheDocument();
    }

    /* El historial (vista Realizados, activa en este punto) tiene filas DE VERDAD con el día
       congelado: si `HOY` se saliera del rango de los datos de ejemplo, la tabla quedaría vacía y
       estaríamos capturando una pantalla sin contenido sin enterarnos. */
    await expect(canvasElement.querySelectorAll("tbody tr").length).toBeGreaterThan(0);

    // Y se puede volver a Pendientes.
    canvas.getByRole("button", { name: "Pendientes" }).click();
    await waitFor(() => expect(canvas.getByText("Ver cobros hasta")).toBeInTheDocument());
  },
};

/* ────────────────────────── Ley 7 · tres anchos, 0 snapshots ────────────────────────── */

/** El mínimo que pide la spec (§5.2). Es el piso, no la medición fuerte: ver las dos de abajo. */
export const Ley7Angosto360: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 360 px · sin scroll horizontal de página",
  play: async ({ canvasElement }) => {
    await medirLey7SinScrollDePagina(ANCHO_MINIMO, canvasElement);
  },
};

/** 346 px = 360 con la holgura de fuente Linux/Windows (mismo margen y misma razón que
 *  `gestion-v08-view.stories.tsx`): el runner de CI es Linux, con fuentes más anchas que Windows,
 *  así que pasar a 360 en local no dice nada sobre el gate.
 *
 *  Pero NO es la medición que decide, y conviene no creerlo: el desborde del selector de vistas
 *  que este PR arregla medía 343 px, o sea que ESTA story pasaba con el bug puesto (343 ≤ 346) y
 *  la de 360 también. La única que lo vio fue la de 320. El margen de 14 px mata los desbordes
 *  grandes; los de pocos píxeles los agarra el ancho más chico. */
export const Ley7Angosto346: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 346 px · margen de fuente (= 360 en el runner de Linux)",
  play: async ({ canvasElement }) => {
    await medirLey7SinScrollDePagina(ANCHO_MEDIDO, canvasElement);
  },
};

/** 320 px: el más angosto habitual de un teléfono, y acá el ancho que DECIDE. `administracion/v12`
 *  ya había encontrado a 320 una tabla que desbordaba 21 px incluso en Windows; en esta pantalla
 *  encontró el selector de vistas desbordando 23 px, invisible a 346 y a 360. Sacando el
 *  `flex-wrap` del selector, esta story —y sólo ésta— se pone roja: verificado mutando. */
export const Ley7Angosto320: Story = {
  parameters: SOLO_TEST_STORYBOOK,
  name: "Ley 7 · 320 px · ancho de teléfono",
  play: async ({ canvasElement }) => {
    await medirLey7SinScrollDePagina(320, canvasElement);
  },
};
