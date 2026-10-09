/* Lectores de SUPERFICIE: leen la cifra que el usuario VE en la pantalla. NO es un spec.

   LA REGLA DE ESTE ARCHIVO, que es la regla del gate: un lector afirma PRESENCIA Y VALOR.
   Ningún `expect` del gate puede quedar satisfecho por una página que no cargó, por una ruta
   ausente que devolvió 404 ni por un elemento que no está. Por eso:

     · `abrir()` exige un ancla de la pantalla antes de leer nada. Si no apareció, la pantalla queda
       marcada como fallida y TODOS sus lectores devuelven `noMedible` con ese motivo. No hay forma
       de leer una cifra de una pantalla que no se abrió.
     · `leerKpi()` localiza la tarjeta por su etiqueta, lee el slot del valor y exige que de ahí
       salga un número. "sin dato", "Sin dato", "Sin información" y "s/d" — los cuatro "no sé" del
       producto (`src/components/rediseno/sin-dato.tsx`, `src/lib/formatters/clp.ts`) — devuelven
       `noMedible` con el rótulo que se vio, nunca `0`.
     · Un cero de verdad SÍ se mide: "$0" devuelve `medido(0)`. Faltante no es cero, y cero no es
       faltante; el gate necesita distinguirlos y por eso están separados.

   Las etiquetas y regiones de acá están verificadas contra el código de las vistas que la app
   monta en producción con los flags de `wrangler.toml`:
     · `/inicio`  → `src/components/inicio/resumen/inicio-resumen-view.tsx` (NO monta `hoy-view.tsx`)
     · `/caja`    → `src/components/caja/v02/caja-v02-view.tsx`
     · `/banco`   → `src/components/banco/v03/banco-v03-view.tsx`
   El atributo `data-kpi` que se prefiere como ancla lo publica `src/components/rediseno/kpi-card.tsx`.
   Mientras la versión desplegada no lo traiga, el lector cae a la etiqueta visible y lo DICE en la
   evidencia, para que una medición por el camino frágil no se confunda con una por el camino firme. */

import type { Locator, Page } from "@playwright/test";
import { medido, noMedible, type Medicion } from "./medicion";

/** Los "no sé" del producto. Ninguno es un cero. */
const ROTULOS_SIN_DATO = ["sin dato", "sin información", "sin informacion", "s/d", "en revisión"];

/**
 * Moneda que el contrato no declaró. `formatMoney` la rinde como «1.234,50 · moneda no informada»
 * (`src/lib/formatters/clp.ts`, `MONEDA_NO_INFORMADA`): la cifra está, el código ISO no.
 *
 * El lector NO puede rellenarla con "CLP". Esa misma suposición —`currency || "CLP"`— es la que
 * mostraba un monto en dólares con signo de peso y sin decimales, y a ~950 pesos por dólar
 * equivocaba la cifra por casi mil veces. Si el lector la repusiera, el gate compararía dólares
 * contra pesos y los llamaría coincidencia. Se marca como moneda distinta a propósito: cualquier
 * comparación contra una cifra en CLP devuelve `divergen`, que es exactamente lo que corresponde.
 */
export const MONEDA_SIN_DECLARAR = "SIN-DECLARAR";

export interface MontoLeido {
  valor: number;
  moneda: string;
}

/**
 * Lee un monto de un texto tal como lo imprime el producto.
 *
 * Cubre, a propósito y por separado:
 *   · el menos TIPOGRÁFICO U+2212 que `formatClp` antepone al signo `$` ("−$300.000"), que no es
 *     el guion ASCII y que un `Number()` directo no entiende;
 *   · el prefijo de moneda ("$", "US$" con espacio duro U+00A0, "EUR ", "UF ");
 *   · el separador de miles "." y el decimal "," de es-CL;
 *   · el signo "+" explícito del KPI "Entra · 14 días".
 * Devuelve `null` cuando no hay número: un rótulo de ausencia, una cadena vacía o texto suelto.
 */
export function leerMonto(texto: string | null | undefined): MontoLeido | null {
  if (!texto) return null;
  const limpio = texto.replace(/ /g, " ").trim();
  if (!limpio) return null;
  if (ROTULOS_SIN_DATO.some((r) => limpio.toLowerCase().includes(r))) return null;

  const negativo = /[−-]/.test(limpio.replace(/(?<=\d)-(?=\d)/g, ""));
  const moneda = /moneda no informada/i.test(limpio)
    ? MONEDA_SIN_DECLARAR
    : /US\$/i.test(limpio)
      ? "USD"
      : /\bEUR\b/i.test(limpio)
        ? "EUR"
        : /\bUF\b/i.test(limpio)
          ? "UF"
          : /\$/.test(limpio)
            ? "CLP"
            : "CLP";

  const digitos = limpio.match(/[\d.,]+/g);
  if (!digitos || digitos.length === 0) return null;
  // El grupo más largo es el monto: descarta "14" de "Entra · 14 días" cuando conviven.
  const crudo = digitos.reduce((a, b) =>
    b.replace(/\D/g, "").length >= a.replace(/\D/g, "").length ? b : a,
  );
  const normalizado = crudo.replace(/\./g, "").replace(",", ".");
  const n = Number(normalizado);
  if (!Number.isFinite(n) || normalizado === "") return null;
  return { valor: negativo ? -Math.abs(n) : n, moneda };
}

/** Una pantalla abierta y verificada. Si `fallo` no es `null`, ninguna lectura concluye. */
export interface Pantalla {
  readonly nombre: string;
  readonly ruta: string;
  readonly page: Page;
  /** Motivo por el que la pantalla NO sirve para medir (404, no cargó, ancla ausente). */
  readonly fallo: string | null;
}

export interface OpcionesAbrir {
  /** Ancla obligatoria: si no aparece, la pantalla queda inservible para medir. */
  readonly ancla: (page: Page) => Locator;
  /** Cómo se llama el ancla en el mensaje de falla. */
  readonly anclaNombre: string;
  readonly timeout?: number;
}

/**
 * Abre una ruta y verifica que la pantalla REALMENTE cargó.
 *
 * Tres cosas se verifican por separado, porque fallan por razones distintas y el gate necesita
 * saber cuál pasó: (1) la navegación devolvió un status de éxito — un 404 de ruta ausente no
 * puede pasar por "la cifra no está"; (2) no quedó en /login (sesión vencida); (3) el ancla de la
 * pantalla apareció.
 */
export async function abrir(
  page: Page,
  nombre: string,
  ruta: string,
  opts: OpcionesAbrir,
): Promise<Pantalla> {
  let fallo: string | null = null;
  try {
    const res = await page.goto(ruta, { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    if (status >= 400) {
      fallo = `la ruta ${ruta} respondió ${status}: la pantalla no existe o no se pudo servir`;
    }
  } catch (e) {
    fallo = `no se pudo abrir ${ruta}: ${(e as Error).message}`;
  }
  if (!fallo) {
    const destino = new URL(page.url()).pathname;
    if (/\/login/.test(destino)) {
      fallo = `${ruta} redirigió a ${destino}: la sesión no es válida (renueva QAVANTE_SESSION)`;
    }
  }
  if (!fallo) {
    try {
      await opts
        .ancla(page)
        .first()
        .waitFor({ state: "visible", timeout: opts.timeout ?? 30_000 });
    } catch {
      fallo = `${ruta} cargó pero ${opts.anclaNombre} no apareció: la pantalla no se montó, así que no hay cifra que leer`;
    }
  }
  return { nombre, ruta, page, fallo };
}

export interface OpcionesKpi {
  /** `aria-label` de la sección que contiene la tarjeta, para no cazar otra igual. */
  readonly region?: string;
  /** Etiqueta exacta de la tarjeta, como la escribe la vista ("Hoy", "Caja hoy", "Entra · 14 días"). */
  readonly etiqueta: string;
}

/**
 * Lee el valor de una tarjeta KPI. Presencia Y valor:
 *   · tarjeta ausente        → `noMedible` ("la tarjeta no está en la pantalla")
 *   · tarjeta con "sin dato" → `noMedible` con el motivo que publica el propio producto
 *   · tarjeta con un número  → `medido`, con el texto crudo en la evidencia
 */
/**
 * Mientras una pantalla carga, varias vistas montan la tarjeta YA, en su rama de ausencia: en
 * `/banco`, `cajaHoy(summary)` con el resumen todavía en vuelo devuelve `monto: null` y la tarjeta
 * «Caja hoy» se pinta con `sinDato` hasta que llega el dato
 * (`src/components/banco/v03/banco-v03-view.tsx`). El ancla de la pantalla aparece antes que la
 * cifra, así que una lectura inmediata puede concluir «no publica número» sobre algo que sí lo
 * publica un segundo después. Eso es un falso «no pude medir», y manda a investigar lo que no está
 * roto — justo el ruido que vuelve ignorable a un gate.
 *
 * Por eso se reintenta hasta este plazo. NO es relajar la aserción: pasado el plazo, «sin dato»
 * sigue siendo `noMedible` con el rótulo que la pantalla publica. Lo único que cambia es que el
 * veredicto se emite sobre la pantalla ya cargada y no sobre la pantalla cargando.
 */
const PLAZO_PARA_QUE_APAREZCA_LA_CIFRA_MS = 15_000;

/**
 * Reintenta `leer` hasta que devuelva un monto, o hasta agotar el plazo. Devuelve LO ÚLTIMO VISTO.
 *
 * Que devuelva lo último visto y no `null` es la parte que impide que esto sea una relajación: si
 * la cifra nunca aparece, el llamador recibe el rótulo que la pantalla publica («sin dato») y emite
 * `noMedible` con ese texto, igual que antes. Lo exportado se prueba en `gemelos.spec.ts`.
 */
export async function conEspera(
  leer: () => Promise<string | null>,
  plazoMs = PLAZO_PARA_QUE_APAREZCA_LA_CIFRA_MS,
): Promise<string | null> {
  const limite = Date.now() + plazoMs;
  let ultimo: string | null = null;
  for (;;) {
    ultimo = await leer();
    if (ultimo !== null && leerMonto(ultimo) !== null) return ultimo;
    if (Date.now() >= limite) return ultimo;
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function leerKpi(pantalla: Pantalla, opts: OpcionesKpi): Promise<Medicion> {
  const fuente = `${pantalla.nombre} · KPI ${opts.etiqueta}`;
  if (pantalla.fallo) return noMedible(fuente, pantalla.fallo);

  const raiz = opts.region
    ? pantalla.page.getByRole("region", { name: opts.region })
    : pantalla.page.locator("body");

  // Camino firme: el atributo que publica KpiCard. Camino frágil: la etiqueta visible.
  const porAtributo = raiz.locator(`[data-kpi=${JSON.stringify(opts.etiqueta)}] [data-kpi-valor]`);
  const porEtiqueta = raiz
    .locator(`div:has(> span:text-is(${JSON.stringify(opts.etiqueta)}))`)
    .locator("xpath=following-sibling::div[1]");

  for (const [via, loc] of [
    ["data-kpi", porAtributo],
    ["etiqueta visible", porEtiqueta],
  ] as const) {
    if ((await loc.count()) === 0) continue;
    const texto = await conEspera(async () => {
      try {
        if ((await loc.count()) === 0) return null;
        return await loc.first().innerText({ timeout: 5_000 });
      } catch {
        return null;
      }
    });
    if (texto === null) continue;
    const monto = leerMonto(texto);
    if (monto) {
      return medido(`${fuente} (vía ${via})`, monto.valor, monto.moneda, texto.trim());
    }
    return noMedible(
      `${fuente} (vía ${via})`,
      `la tarjeta está pero no publica un número: dice "${texto.trim().replace(/\s+/g, " ").slice(0, 140)}"`,
    );
  }
  return noMedible(
    fuente,
    `la tarjeta no está en ${pantalla.ruta}${opts.region ? ` (región "${opts.region}")` : ""}: no hay cifra que leer`,
  );
}

/**
 * Lee un monto de un texto de la pantalla que calza con un patrón, extrayendo el grupo 1.
 * Para cifras que el producto publica en prosa, no en una tarjeta (el total por moneda de /banco,
 * el aviso de pendientes de /caja).
 */
export async function leerDeTexto(
  pantalla: Pantalla,
  fuenteNombre: string,
  patron: RegExp,
  opts: { moneda?: string; comoEntero?: boolean } = {},
): Promise<Medicion> {
  const fuente = `${pantalla.nombre} · ${fuenteNombre}`;
  if (pantalla.fallo) return noMedible(fuente, pantalla.fallo);
  let texto = "";
  try {
    const loc = pantalla.page.getByText(patron).first();
    if ((await loc.count()) === 0) {
      return noMedible(fuente, `la pantalla no publica ningún texto que calce con ${patron}`);
    }
    texto = await loc.innerText({ timeout: 10_000 });
  } catch (e) {
    return noMedible(fuente, `no se pudo leer el texto de ${patron}: ${(e as Error).message}`);
  }
  const m = patron.exec(texto.replace(/\s+/g, " "));
  if (!m || m[1] === undefined) {
    return noMedible(
      fuente,
      `el texto está pero no trae la cifra esperada: "${texto.trim().replace(/\s+/g, " ").slice(0, 160)}"`,
    );
  }
  if (opts.comoEntero) {
    const n = Number(m[1]!.replace(/\./g, ""));
    return Number.isFinite(n)
      ? medido(fuente, n, "unidades", m[1]!)
      : noMedible(fuente, `"${m[1]}" no es un entero`);
  }
  const monto = leerMonto(m[1]!);
  return monto
    ? medido(fuente, monto.valor, opts.moneda ?? monto.moneda, m[1]!)
    : noMedible(fuente, `"${m[1]}" no es un monto legible`);
}

/* ── Anclas verificadas de cada pantalla ──────────────────────────────────────────────────────
   Cada una es la prueba de que la pantalla se montó. Si una de estas cambia, el gate falla con
   "la pantalla no se montó" en vez de medir de menos en silencio, que es justo lo que se evita. */

export const ANCLAS = {
  inicio: {
    ruta: "/inicio",
    ancla: (p: Page) => p.getByTestId("inicio-resumen"),
    anclaNombre: 'el resumen de Inicio (testid "inicio-resumen")',
  },
  caja: {
    ruta: "/caja",
    ancla: (p: Page) => p.getByRole("region", { name: "Hoy, entra y sale" }),
    anclaNombre: 'la tríada de KPI de Caja (región "Hoy, entra y sale")',
  },
  banco: {
    ruta: "/banco",
    ancla: (p: Page) => p.getByRole("region", { name: "Caja hoy" }),
    anclaNombre: 'el KPI "Caja hoy" de Banco (región "Caja hoy")',
  },
  /* OJO: el título de /cobrar es "Gestión de cobros" y lo publica el layout, no la página; y la
     tarjeta "Por cobrar" es un `MetricCard` del módulo de cobranza, no un `KpiCard` del rediseño.
     Una ancla escrita de memoria (/Cobrar/) no calza con nada y el gate quedaría midiendo de menos. */
  cobrar: {
    ruta: "/cobrar",
    ancla: (p: Page) => p.getByRole("region", { name: "Resumen de cobranza" }),
    anclaNombre: 'el resumen de cobranza (región "Resumen de cobranza")',
  },
  pagar: {
    ruta: "/pagar",
    ancla: (p: Page) => p.getByRole("region", { name: "Resumen de pagos" }),
    anclaNombre: 'la tríada de KPI de Pagar (región "Resumen de pagos")',
  },
  /* El contador de pendientes vive en el `<h1>` de V07 ("27 pendientes") y también en el bloque
     `work-inbox`. El `<h1>` es el que ve el usuario; cuando no hay pendientes dice "Nada espera tu
     decisión" y entonces el lector debe decir que no pudo medir, no suponer cero. */
  bandeja: {
    ruta: "/bandeja",
    ancla: (p: Page) => p.getByTestId("work-inbox"),
    anclaNombre: 'el resumen de la Bandeja (testid "work-inbox")',
  },
  /* PULSO no vive en /gestion/pulso: esa ruta redirige a /alertas (src/app/(app)/gestion/pulso/page.tsx). */
  alertas: {
    ruta: "/alertas",
    ancla: (p: Page) => p.getByRole("heading", { level: 1, name: "Alertas" }),
    anclaNombre: 'el título "Alertas" (donde vive PULSO)',
  },
  /* QHS: /gestion/salud es una pantalla estática en construcción que NO hace ninguna llamada a la
     API. Se abre igual, a propósito: el invariante 12 tiene que poder decir que QHS no publica
     veredicto, en vez de que el brazo desaparezca del gate sin dejar rastro. */
  salud: {
    ruta: "/gestion/salud",
    ancla: (p: Page) => p.getByRole("heading", { level: 1, name: "Salud de tu empresa" }),
    anclaNombre: 'el título "Salud de tu empresa" (QHS)',
  },
  remuneraciones: {
    ruta: "/remuneraciones",
    ancla: (p: Page) => p.getByRole("heading", { level: 1, name: "Remuneraciones" }),
    anclaNombre: 'el título "Remuneraciones"',
  },
  f29: {
    ruta: "/pagar/impuestos/f29",
    ancla: (p: Page) => p.getByRole("region", { name: "Estado del F29 por período" }),
    anclaNombre: 'la grilla del F29 (región "Estado del F29 por período")',
  },
} as const;

export type NombrePantalla = keyof typeof ANCLAS;

export async function abrirPantalla(page: Page, nombre: NombrePantalla): Promise<Pantalla> {
  const a = ANCLAS[nombre];
  return abrir(page, nombre, a.ruta, { ancla: a.ancla, anclaNombre: a.anclaNombre });
}

/**
 * Lee el valor de un `MetricCard` del módulo de cobranza
 * (`src/components/cobrar/gestion-cobros-live.tsx`), que NO es un `KpiCard` y por lo tanto no trae
 * `data-kpi`: su DOM es una fila con la etiqueta y debajo un `<p>` con `tabular-nums`.
 *
 * Igual que `leerKpi`: presencia Y valor. Una tarjeta cuyo valor es una acción
 * ("Volver a calcular", "Conciliación por cerrar", "Sin información") devuelve `noMedible` con ese
 * rótulo, porque es literalmente lo que el producto dice cuando no tiene la cifra.
 */
export async function leerMetricCard(
  pantalla: Pantalla,
  opts: { region?: string; etiqueta: string },
): Promise<Medicion> {
  const fuente = `${pantalla.nombre} · tarjeta ${opts.etiqueta}`;
  if (pantalla.fallo) return noMedible(fuente, pantalla.fallo);
  const raiz = opts.region
    ? pantalla.page.getByRole("region", { name: opts.region })
    : pantalla.page.locator("body");
  const valor = raiz.locator(`[data-metric=${JSON.stringify(opts.etiqueta)}] [data-metric-valor]`);
  if ((await valor.count()) === 0) {
    return noMedible(
      fuente,
      `la tarjeta "${opts.etiqueta}" no está en ${pantalla.ruta}${opts.region ? ` (región "${opts.region}")` : ""}: no hay cifra que leer`,
    );
  }
  // Misma espera que `leerKpi`: la tarjeta se monta antes de que llegue el dato.
  const texto =
    (await conEspera(async () => {
      try {
        if ((await valor.count()) === 0) return null;
        return await valor.first().innerText({ timeout: 5_000 });
      } catch {
        return null;
      }
    })) ?? "";
  const monto = leerMonto(texto);
  return monto
    ? medido(fuente, monto.valor, monto.moneda, texto.trim())
    : noMedible(
        fuente,
        `la tarjeta está pero publica una acción o un rótulo de ausencia en vez de una cifra: "${texto.trim().replace(/\s+/g, " ").slice(0, 140)}"`,
      );
}

/**
 * Lee el contador de pendientes de la Bandeja desde el `<h1>` que ve el usuario
 * (`src/components/bandeja/v07/bandeja-v07-view.tsx`).
 *
 * Los tres títulos posibles se tratan distinto a propósito:
 *   · "27 pendientes"                        → `medido(27)`
 *   · "Nada espera tu decisión"              → `medido(0)`: es un cero que el producto AFIRMA.
 *   · "No podemos decirte cuánto te queda"   → `noMedible`: es la fuente caída, no un cero.
 * Aplastar el tercer caso a 0 haría que el invariante 4 comparara un cero inventado con el conteo
 * real de la API y lo llamara divergencia, o peor, coincidencia cuando la API también falla.
 */
export async function leerPendientesBandeja(pantalla: Pantalla): Promise<Medicion> {
  const fuente = "Bandeja · contador de pendientes";
  if (pantalla.fallo) return noMedible(fuente, pantalla.fallo);

  /* OJO: /bandeja monta DOS `<h1>`. El de `work-inbox-summary` dice "Bandeja" y el de V07 trae el
     contador. Tomar `.first()` devolvería "Bandeja" y el lector diría que no pudo medir sobre una
     pantalla que sí publica el número: un falso "no medible" es tan malo como un falso cero, porque
     manda a investigar lo que no está roto. Por eso se prueban las dos fuentes, en orden. */

  // (1) El bloque `work-inbox`: un `<p>` con el total y otro que dice "pendientes en cuatro colas".
  try {
    const bloque = pantalla.page.getByTestId("work-inbox");
    if ((await bloque.count()) > 0) {
      const texto = (await bloque.first().innerText({ timeout: 10_000 })).replace(/\s+/g, " ");
      const m = /(\d+)\s+pendientes en/.exec(texto);
      if (m) return medido(`${fuente} (bloque work-inbox)`, Number(m[1]), "unidades", m[0]);
    }
  } catch {
    /* se intenta la segunda fuente */
  }

  // (2) El `<h1>` de V07, que es el titular que lee el usuario.
  let titulo = "";
  try {
    const titulares = pantalla.page.getByRole("heading", { level: 1 });
    const n = await titulares.count();
    for (let i = 0; i < n; i += 1) {
      const t = (await titulares.nth(i).innerText({ timeout: 10_000 })).trim();
      if (
        /pendiente|Nada espera tu decisión|No hay movimientos por revisar|No podemos decirte/i.test(
          t,
        )
      ) {
        titulo = t;
        break;
      }
    }
  } catch (e) {
    return noMedible(fuente, `no se pudo leer el titular de la Bandeja: ${(e as Error).message}`);
  }
  if (!titulo) {
    return noMedible(
      fuente,
      "ni el bloque work-inbox ni ningún titular de la Bandeja publican un contador de pendientes",
    );
  }
  if (/No podemos decirte/i.test(titulo)) {
    return noMedible(
      `${fuente} (titular de V07)`,
      `la Bandeja dice "${titulo}": la fuente del conteo está caída, no hay cero que afirmar`,
    );
  }
  if (/Nada espera tu decisión|No hay movimientos por revisar/i.test(titulo)) {
    // Un cero que el producto AFIRMA sí es una medición; lo que no se afirma es la fuente caída.
    return medido(`${fuente} (titular de V07)`, 0, "unidades", titulo);
  }
  const n = /^(\d+)\s+pendiente/.exec(titulo);
  return n
    ? medido(`${fuente} (titular de V07)`, Number(n[1]), "unidades", titulo)
    : noMedible(fuente, `el titular de la Bandeja no trae un contador: "${titulo}"`);
}
