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
  MOV_DATTATEC,
  MOV_ENTEL_1,
  MOV_ENTEL_2,
  MOV_ENTEL_3,
  MOV_KAUFMANN,
  MOV_TERCEROS,
  MOV_VOLCAN,
  candidatosKaufmann,
  candidatosVolcan,
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
    clasificados: clasificados(),
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
  it("N pendientes con su ~X min (X = N×80 s) y las dos tabs con su conteo", () => {
    const t = texto(html());
    // 2 por conciliar + 5 por clasificar = 7 · 80 s = 560 s ≈ 9 min.
    expect(t).toContain("7 pendientes · ~9 min");
    expect(t).toContain("Conciliar · 2");
    expect(t).toContain("Clasificar · 5");
  });

  it("el progreso dice 'en esta sesión', NO 'hoy' — no hay bitácora que respalde el 'hoy'", () => {
    const t = texto(html());
    expect(t).toContain("0 de 7 resueltos en esta sesión");
    expect(t).toContain("$0 dejaron de estar en duda");
    expect(t).not.toContain("resueltos hoy");
    // Y el hueco queda declarado en la pantalla, no sólo en el PR.
    expect(t).toContain("El progreso cuenta lo resuelto en esta sesión y no “hoy”");
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
    expect(texto(h)).not.toContain("Elige una categoría para guardar");
  });

  it("el detalle opcional lleva notas y DECLARA que las vistas de gestión no se asignan acá", () => {
    const h = html(conRegla());
    const t = texto(h);
    expect(t).toContain("+ Agregar detalle (opcional)");
    expect(t).toContain("Nota para el contador");
    expect(t).toContain("Las vistas de gestión (dimensiones) todavía no se asignan desde acá");
    expect(h).toContain(`href="/caja/por-clasificar?movimiento=${MOV_DATTATEC}"`);
  });

  it("dice, ANTES de guardar, que no va a haber Deshacer y por qué", () => {
    expect(texto(html(conRegla()))).toContain(
      "Al guardar no vas a ver un “Deshacer”: clasificar todavía no se puede revertir",
    );
  });

  it("lote: 3 del mismo RUT ⇒ banner 'Hay 2 más', con el bulk declarado como imposible hoy", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        clasificar: CLASIFICAR([MOV_ENTEL_1, MOV_ENTEL_2, MOV_ENTEL_3, MOV_DATTATEC]),
        sugerencia: { movimientoId: MOV_ENTEL_1, valor: null, cargando: false },
      }),
    );
    expect(t).toContain("Hay 2 más de 92.580.000-7 esperando categoría");
    expect(t).toContain("Clasificarlos de una sola vez todavía no se puede");
    expect(t).toContain("Revisar los 3 seguidos");
    // Gemelo: con el de Dattatec solo en pantalla, no hay banner de lote.
    expect(texto(html(conRegla()))).not.toContain("esperando categoría");
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

  it("los huecos se declaran en pantalla, con su issue sucesor", () => {
    const t = texto(html());
    expect(t).toContain("clasificar un lote de una sola vez");
    expect(t).toContain("deshacer una clasificación");
    expect(t).toContain("registrar el par negativo");
    expect(t).toContain("Sucesor: #90.");
  });
});
