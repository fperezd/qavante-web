import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { BandejaV07View } from "./bandeja-v07-view";
import {
  candidatos as adaptarCandidatos,
  itemsClasificar,
  itemsConciliar,
} from "./bandeja-v07-model";
import {
  HOY,
  CUENTA_SOFTWARE,
  MOV_DATTATEC,
  MOV_ENTEL_1,
  MOV_ENTEL_2,
  MOV_ENTEL_3,
  MOV_KAUFMANN,
  MOV_TERCEROS,
  MOV_VOLCAN,
  candidatosKaufmann,
  candidatosVolcan,
  categoriasCanonicas,
  clasificados,
  colaConciliar,
  colaConciliarVacia,
  cuentas,
  sinClasificar,
  sinClasificarVacio,
  sugerenciaSoftware,
} from "./bandeja-v07-fixtures";

/* V07 · Bandeja — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Acá se fija lo que se puede leer del HTML: los chips de la Ley 3 (que existan cuando la
 * verificación pasa y que NO existan cuando no pasa), qué botón primario ofrece cada caso, que
 * Guardar no lleve `disabled` (Ley 6), y que el dato primario no se trunque (Ley 7). Las
 * interacciones —Enter, el toast y su Deshacer, el auto-avance— viven en las stories, porque
 * necesitan DOM vivo. */

type Props = ComponentProps<typeof BandejaV07View>;

const CONCILIAR = () => itemsConciliar(colaConciliar());
const CLASIFICAR = (orden?: string[]) => itemsClasificar(sinClasificar(orden));

function base(): Props {
  return {
    conciliar: CONCILIAR(),
    clasificar: CLASIFICAR(),
    candidatos: {
      movimientoId: MOV_KAUFMANN,
      lista: adaptarCandidatos(candidatosKaufmann()),
      cargando: false,
    },
    cuentas: cuentas(),
    categoriasCanonicas: categoriasCanonicas(),
    clasificados: clasificados(),
    onConciliar: async () => undefined,
    onNoEsEsta: async () => undefined,
    onClasificar: async () => undefined,
    issueSucesor: "#90",
    hoy: HOY,
  };
}

function html(props: Partial<Props> = {}): string {
  return renderToStaticMarkup(<BandejaV07View {...base()} {...props} />);
}

function texto(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ley 2 — cuántos elementos llevan token rojo (ambos sistemas de tokens del repo). */
function rojos(h: string): number {
  return (h.match(/class="[^"]*(rediseno-rojo|danger-)[^"]*"/g) ?? []).length;
}

/** Los chips del why-strip que hay en el HTML (las pills `mut` del bloque Evidencia). */
function chips(h: string): string[] {
  const bloque = /Evidencia<\/span>([\s\S]*?)<\/p>/.exec(h);
  if (!bloque) return [];
  return [...bloque[1]!.matchAll(/<span class="[^"]*rediseno-neutro-bg[^"]*"[^>]*>([^<]*)</g)].map(
    (m) => m[1]!,
  );
}

describe("BandejaV07View — cabecera y progreso", () => {
  it("muestra N pendientes y las dos tabs con su conteo", () => {
    const t = texto(html());
    expect(t).toContain("7 pendientes");
    expect(t).not.toContain("min");
    expect(t).toContain("Conciliar · 2");
    expect(t).toContain("Clasificar · 5");
  });

  it("muestra el total no paginado aunque la cola visible esté limitada", () => {
    const t = texto(html({ conciliarTotal: 2, clasificarTotal: 137 }));
    expect(t).toContain("139 pendientes");
    expect(t).not.toContain("min");
    expect(t).toContain("Conciliar · 2");
    expect(t).toContain("Clasificar · 137");
  });

  it("el progreso dice 'en esta sesión', NO 'hoy' — no hay bitácora que respalde el 'hoy'", () => {
    const t = texto(html());
    expect(t).toContain("0 de 7 resueltos en esta sesión");
    expect(t).toContain("$0 dejaron de estar en duda");
    expect(t).not.toContain("resueltos hoy");
    // Y el hueco queda declarado en la pantalla, no sólo en el PR.
    expect(t).toContain("El progreso cuenta lo resuelto en esta sesión y no “hoy”");
  });

  it("usa Sora en títulos y montos, Figtree en copy operativo y mono sólo en atajos", () => {
    const h = html();

    // El div raíz, no sólo el eyebrow, da Figtree a TODO el copy operativo de la pantalla.
    // El ancla de contenido evita que una clase en un contenedor vacío certifique el contrato.
    expect(h).toMatch(
      /<div class="space-y-4 font-rediseno-sans">[\s\S]*?<p[^>]*>Bandeja · lo que el piloto separó para ti<\/p>/,
    );
    const vacia = html({
      conciliar: itemsConciliar(colaConciliarVacia()),
      clasificar: itemsClasificar(sinClasificarVacio()),
    });
    expect(vacia).toMatch(
      /<div class="space-y-4 font-rediseno-sans">[\s\S]*?Nada espera tu decisión/,
    );
    const error = html({
      conciliar: null,
      clasificar: null,
      conciliarMotivo: "La cola no respondió.",
    });
    expect(error).toMatch(
      /<div[^>]*role="status"[^>]*class="[^"]*font-rediseno-sans[^"]*"[\s\S]*?No pudimos consultar tu bandeja de excepciones/,
    );
    expect(error).toMatch(/<h3[^>]*font-sans[^>]*>No pudimos consultar tu bandeja de excepciones/);

    // Títulos, monto y labels de operación no deben volver a la estética editorial/técnica.
    expect(h).toMatch(/<h1[^>]*font-sans[^>]*>/);
    expect(h).toMatch(/<h2[^>]*font-sans[^>]*>/);
    expect(h).toMatch(/<p[^>]*font-sans[^>]*tabular-nums[^>]*>Abono \$2\.380\.000/);
    expect(h).toMatch(/<p[^>]*font-rediseno-sans[^>]*text-\[12px\][^>]*>Bandeja/);
    expect(h).not.toMatch(/<(?:h1|h2|p)[^>]*font-rediseno-(?:serif|mono)[^>]*>/);

    // El atajo es la única excepción: es código, no copy operativo.
    expect(h).toMatch(/<span[^>]*font-rediseno-mono[^>]*>Enter<\/span>/);
  });
});

describe("BandejaV07View — carta de conciliar CON evidencia (Kaufmann)", () => {
  it("el why dice por qué no lo resolvió solo", () => {
    expect(texto(html())).toContain(
      "Conciliar 1 de 2 · el piloto no lo resolvió solo: el motor no superó su umbral de confianza",
    );
  });

  it("evidencia a DOS lados: folio, fecha y monto en ambos", () => {
    const t = texto(html());
    expect(t).toContain("En el banco · 26 ago 2026");
    expect(t).toContain("Abono $2.380.000");
    expect(t).toContain("TRANSFERENCIA DE COMERCIAL KAUFMANN 96572360-9 FAC 435");
    expect(t).toContain("Candidato · DTE 33 · 435");
    expect(t).toContain("Comercial Kaufmann S.A. · 96.572.360-9 · 5 ago 2026");
  });

  it("LEY 3 — los cinco chips son verificaciones que PASARON, y se listan", () => {
    expect(chips(html())).toEqual([
      "RUT en la glosa",
      "folio 435 en la glosa",
      "el nombre de la contraparte en la glosa",
      "monto exacto",
      "a 21 días del documento",
    ]);
  });

  it("la línea de diferencia dice que calza exacto y cuándo es el documento", () => {
    expect(texto(html())).toContain(
      "El monto calza exacto con el documento. El documento es de hace 25 días.",
    );
  });

  it("con sugerencia, el primario es 'Sí, conciliar' con su atajo Enter", () => {
    const t = texto(html());
    expect(t).toContain("Sí, conciliar Enter");
    expect(t).toContain("No es esta N");
    expect(t).toContain("Buscar otra B");
    expect(t).toContain("Saltar →");
  });
});

describe("BandejaV07View — carta de conciliar SIN evidencia (el caso del HTML de referencia)", () => {
  function volcan(): Partial<Props> {
    return {
      conciliar: CONCILIAR().filter((i) => i.id === MOV_VOLCAN),
      candidatos: {
        movimientoId: MOV_VOLCAN,
        lista: adaptarCandidatos(candidatosVolcan()),
        cargando: false,
      },
    };
  }

  it("CERO chips, y se dice por qué no hay ninguno (no se pinta un chip que no pasó)", () => {
    const h = html(volcan());
    expect(chips(h)).toEqual([]);
    expect(texto(h)).toContain("ninguna verificación pasó entre estos dos lados");
    // Gemelo positivo con la MISMA query: el caso con evidencia sí trae chips.
    expect(chips(html())).toHaveLength(5);
  });

  it("el why enumera lo que falta, y la diferencia se muestra como parcialidad", () => {
    const t = texto(html(volcan()));
    expect(t).toContain(
      "el piloto no lo resolvió solo: el monto no calza exacto y el RUT no aparece en la glosa y la fecha está lejos",
    );
    expect(t).toContain(
      "Pago parcial: entraron $1.033.076 de $1.063.341; quedan $30.265 por cobrar.",
    );
  });

  it("LEY 3 — NO ofrece 'Sí, conciliar': el primario manda a elegir el documento a mano", () => {
    const h = html(volcan());
    expect(texto(h)).toContain("Buscar el documento B");
    expect(h).not.toMatch(/>Sí, conciliar <span/);
    expect(texto(h)).toContain(
      "Sin el RUT en la glosa y sin un monto que calce, esto no se sugiere: va a revisión manual.",
    );
    // Gemelo: en el caso con evidencia ese texto NO está y el botón sí.
    expect(texto(html())).not.toContain("va a revisión manual");
    expect(html()).toMatch(/>Sí, conciliar <span/);
  });
});

describe("BandejaV07View — carta de clasificar", () => {
  it("separa tipo canónico de cuenta de gestión y filtra tipos incompatibles con el cargo", () => {
    const h = html({ tabInicial: "clasificar" });
    const t = texto(h);
    expect(t).toContain("Tipo de movimiento");
    expect(t).toContain("Cuenta de gestión");
    expect(t).toContain("Pago a proveedor");
    expect(t).toContain("Gasto operacional");
    expect(t).not.toContain("Cobro de cliente");
    expect(t).not.toContain("Por revisar");
  });

  it("un parcial conserva la cuenta que el usuario ya había elegido", () => {
    const parcial = sinClasificar([MOV_DATTATEC]);
    parcial.items[0] = {
      ...parcial.items[0]!,
      management_account_id: CUENTA_SOFTWARE,
      canonical_category: null,
      classification_status: "partially_classified",
    };
    const h = html({ tabInicial: "clasificar", clasificar: itemsClasificar(parcial) });
    expect(h).toContain(`<option value="${CUENTA_SOFTWARE}" selected="">`);
  });

  const conRegla = (): Partial<Props> => ({
    tabInicial: "clasificar",
    sugerencia: { movimientoId: MOV_DATTATEC, valor: sugerenciaSoftware(), cargando: false },
  });

  const sinRegla = (): Partial<Props> => ({
    tabInicial: "clasificar",
    clasificar: CLASIFICAR([MOV_TERCEROS, MOV_DATTATEC]),
    sugerencia: { movimientoId: MOV_TERCEROS, valor: null, cargando: false },
  });

  it("con regla: la sugerencia va primero, con su confianza", () => {
    const t = texto(html(conRegla()));
    expect(t).toContain("Clasificar 1 de 5 · una regla tuya calza con este movimiento");
    expect(t).toContain("Cargo $89.250 · “PAGO SERVICIOS DATTATEC.COM 76888888-8” · 18 ago 2026");
    expect(t).toContain("Sugerido Software y tecnología · una regla tuya con confianza 92%");
  });

  it("sin regla: NO hay sugerencia y aparecen 3 frecuentes rotulados como lo que son", () => {
    const t = texto(html(sinRegla()));
    expect(t).toContain("sin regla que calce: sin evidencia no se sugiere");
    expect(t).not.toContain("Sugerido");
    expect(t).toContain("Lo que más usaste en movimientos de este tipo y de este tamaño");
    expect(t).toContain("es tu historial, no una sugerencia");
    expect(t).toContain("Arriendo de oficina · 4");
    expect(t).toContain("Honorarios · 3");
    expect(t).toContain("Software y tecnología · 2");
    // La banda de monto deja fuera los sueldos de $8.000.000.
    expect(t).not.toContain("Remuneraciones · 5");
  });

  it("LEY 6 — Guardar NUNCA lleva disabled, y no hay ningún rojo antes de pulsarlo", () => {
    const h = html(conRegla());
    const boton = /<button[^>]*>\s*Guardar/.exec(h)?.[0] ?? "";
    expect(boton).not.toBe("");
    expect(boton).not.toContain("disabled");
    // El único rojo posible aparece DESPUÉS del click (eso lo ejercita la story).
    expect(rojos(h)).toBe(0);
    expect(texto(h)).not.toContain("Elige el tipo de movimiento para completar");
  });

  it("el detalle opcional lleva notas y DECLARA que las vistas de gestión no se asignan acá", () => {
    const h = html(conRegla());
    const t = texto(h);
    expect(t).toContain("+ Agregar detalle (opcional)");
    expect(t).toContain("Nota para el contador");
    expect(t).toContain("Las vistas de gestión (dimensiones) todavía no se asignan desde acá");
    expect(h).toContain(`href="/caja/por-clasificar?movimiento=${MOV_DATTATEC}"`);
  });

  it("dice, ANTES de guardar, que ESE guardado no va a tener Deshacer y por qué (no es un hueco: es del usuario, no automático)", () => {
    const t = texto(html(conRegla()));
    expect(t).toContain(
      "Al guardar no vas a ver un “Deshacer” acá: esto lo decidiste tú, no Qavante solo",
    );
    expect(t).toContain("la Ley 5 cubre lo automático");
  });

  it("lote: 3 del mismo RUT ⇒ banner 'Hay 2 más' y el bulk manual pide confirmación", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        clasificar: CLASIFICAR([MOV_ENTEL_1, MOV_ENTEL_2, MOV_ENTEL_3, MOV_DATTATEC]),
        sugerencia: { movimientoId: MOV_ENTEL_1, valor: null, cargando: false },
        onClasificarLote: async () => undefined,
      }),
    );
    expect(t).toContain("Hay 2 más de 92.580.000-7 esperando categoría");
    expect(t).toContain(
      "Puedes clasificarlos de una sola vez después de elegir categoría y confirmar",
    );
    expect(t).toContain("Clasificar 3 de una vez");
    expect(t).toContain("Revisar los 3 seguidos");
    // Gemelo: con el de Dattatec solo en pantalla, no hay banner de lote.
    expect(texto(html(conRegla()))).not.toContain("esperando categoría");
  });
});

/* Ley 5 en clasificar — verificado contra `api/app/core/treasury_repo.py`: el "Guardar" de esta
 * carta nunca es lo que se deshace acá (ver el test de arriba, "dice ANTES de guardar..."). Lo
 * que sí se lista y se puede deshacer es la bitácora de auto-clasificación
 * (`GET /api/reversible-actions`). Las interacciones de click en "Deshacer" viven en las
 * stories (necesitan DOM vivo para esperar la promesa); acá se fija sólo lo que el HTML dice. */
describe("BandejaV07View — bitácora de auto-clasificación (Ley 5, issue #90)", () => {
  const accion = (
    over: Partial<{ actionId: string; resumen: string; creadaEn: string; vencePlazo: string }> = {},
  ) => ({
    actionId: "accion-1",
    resumen: "Clasificamos un movimiento con la regla 'Software recurrente'",
    creadaEn: "2026-08-30T09:00:00Z",
    vencePlazo: "2026-09-06T09:00:00Z",
    ...over,
  });

  /* Nota: "Qavante clasificó" NO sirve como marcador del banner — el disclaimer del "Guardar"
     y los huecos declarados (siempre en pantalla) también usan esa frase para explicar que
     ESE guardado no tiene Deshacer. El marcador confiable es el botón "Deshacer" de la
     bitácora (único en toda la carta: el de "Guardar" es texto plano, no un botón) y el
     resumen que sólo el backend manda cuando hay algo que listar. */
  it("sin auto-clasificaciones (el caso por defecto): no aparece el botón Deshacer de la bitácora", () => {
    const h = html({ tabInicial: "clasificar" });
    expect(h).not.toMatch(/<button[^>]*>\s*Deshacer\s*<\/button>/);
  });

  it("con UNA auto-clasificación: el resumen del backend, cuándo fue, y el botón Deshacer — sin 'más'", () => {
    /* El botón sólo se pinta si hay a quién avisarle (mismo patrón que `onCrearRegla`): sin
       handler, silencio es lo correcto — no un botón mudo. Acá SÍ pasamos uno. */
    const h = html({
      tabInicial: "clasificar",
      autoClasificadas: [accion()],
      onDeshacerAutoClasificar: async () => ({
        action_id: "accion-1",
        action_type: "bank_movement.auto_classify",
        result: "reverted",
        reverted_at: null,
        detail: {},
      }),
    });
    const t = texto(h);
    expect(t).toContain("Qavante clasificó Clasificamos un movimiento con la regla");
    expect(t).toContain("Software recurrente");
    expect(t).toContain("solo, hoy.");
    // MISMA regex que el negativo de arriba — el gemelo positivo tiene que usarla también.
    expect(h).toMatch(/<button[^>]*>\s*Deshacer\s*<\/button>/);
    expect(t).not.toContain("clasificación automática más");
    expect(t).not.toContain("clasificaciones automáticas más");
  });

  it("N=1: con UNA más además de la primera, el texto va en SINGULAR ('1 clasificación automática más')", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        autoClasificadas: [accion({ actionId: "a1" }), accion({ actionId: "a2" })],
      }),
    );
    expect(t).toContain("Hay 1 clasificación automática más, también deshacible.");
    expect(t).not.toContain("clasificaciones automáticas");
  });

  it("gemelo positivo: con DOS más, el texto va en PLURAL ('2 clasificaciones automáticas más')", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        autoClasificadas: [
          accion({ actionId: "a1" }),
          accion({ actionId: "a2" }),
          accion({ actionId: "a3" }),
        ],
      }),
    );
    expect(t).toContain("Hay 2 clasificaciones automáticas más, también deshacibles.");
    expect(t).not.toContain("1 clasificación automática más");
  });

  it("la bitácora caída lo dice bajito, sin tapar la carta principal de clasificar", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        autoClasificadas: null,
        autoClasificadasMotivo: "La bitácora no respondió.",
      }),
    );
    expect(t).toContain(
      "No pudimos traer lo que Qavante clasificó solo: La bitácora no respondió.",
    );
    // La carta principal sigue viva: no es un DataState de pantalla completa.
    expect(t).toContain("Clasificar 1 de 5");
  });

  it("el banner sólo aparece en el tab de clasificar, no en conciliar", () => {
    const h = html({ tabInicial: "conciliar", autoClasificadas: [accion()] });
    // MISMA regex que los dos tests de arriba.
    expect(h).not.toMatch(/<button[^>]*>\s*Deshacer\s*<\/button>/);
  });
});

describe("BandejaV07View — estados", () => {
  it("bandeja vacía: celebratorio SOBRIO, sin rojo y sin prometer nada de la caja que no sepamos", () => {
    const h = html({
      conciliar: itemsConciliar(colaConciliarVacia()),
      clasificar: itemsClasificar(sinClasificarVacio()),
    });
    const t = texto(h);
    expect(t).toContain("Nada espera tu decisión");
    expect(t).toContain(
      "No quedan movimientos por conciliar ni por clasificar. Tus informes y tu proyección ya no dejan nada de esta bandeja afuera.",
    );
    expect(rojos(h)).toBe(0);
    // Nada de festejos con signos de exclamación ni de afirmar que la caja "ahora incluye todo".
    expect(t).not.toContain("¡");
  });

  it("una fuente caída NO celebra aunque la otra esté vacía: estaríamos ciegos de un lado", () => {
    const t = texto(
      html({
        conciliar: null,
        clasificar: itemsClasificar(sinClasificarVacio()),
        conciliarMotivo: "La cola no respondió.",
      }),
    );
    expect(t).not.toContain("Nada espera tu decisión");
    expect(t).toContain("No podemos decirte cuánto te queda");
    expect(t).toContain("este conteo es parcial");
    expect(t).toContain("No pudimos consultar la cola de conciliación");
  });

  it("las dos fuentes caídas: la pantalla está ciega, no vacía", () => {
    const t = texto(
      html({
        conciliar: null,
        clasificar: null,
        conciliarMotivo: "No pudimos conectar con la cola de conciliación (error de red).",
      }),
    );
    expect(t).toContain("No pudimos consultar tu bandeja de excepciones");
    expect(t).toContain("error de red");
    expect(t).toContain("esta pantalla no está vacía, está ciega");
  });

  it("un aviso de escritura fallida va en ámbar, no gasta el único rojo (Ley 2)", () => {
    const h = html({ avisoError: "No pudimos conciliar este movimiento." });
    expect(texto(h)).toContain("No pudimos conciliar este movimiento.");
    expect(rojos(h)).toBe(0);
  });
});

describe("BandejaV07View — Leyes 2 y 7", () => {
  it("ningún rojo en el render inicial de ninguna de las dos cartas", () => {
    expect(rojos(html())).toBe(0);
    expect(rojos(html({ tabInicial: "clasificar" }))).toBe(0);
  });

  it("el dato primario no se trunca: no hay una sola clase 'truncate' en la pantalla", () => {
    for (const props of [{}, { tabInicial: "clasificar" as const }]) {
      const h = html(props);
      expect(h).not.toContain("truncate");
      expect(h).not.toContain("text-ellipsis");
    }
    // Gemelo positivo: los datos primarios SÍ están, completos, con su clase de quiebre.
    expect(texto(html())).toContain("Comercial Kaufmann S.A.");
    expect(html()).toContain("break-words");
  });

  it("declara el límite real que queda: una decisión manual no tiene Deshacer", () => {
    const t = texto(html());
    expect(t).toContain("deshacer la clasificación que TÚ decidiste al apretar Guardar");
    expect(t).toContain("clasificar un lote");
    expect(t).toContain("la Ley 5 cubre lo automático, no eso");
    expect(t).toContain("Sucesor: #90.");
  });
});
