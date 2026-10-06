import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { BandejaV07View, mensajeSinSugerenciaConciliar } from "./bandeja-v07-view";
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
  MOV_CARGO_PARCIAL,
  MOV_CARGO_EXCESO,
  MOV_KAUFMANN,
  MOV_TERCEROS,
  MOV_VOLCAN,
  candidatosCargoExceso,
  candidatosCargoParcial,
  candidatosKaufmann,
  candidatosVolcan,
  colaConciliarCargos,
  categoriasCanonicas,
  clasificados,
  colaConciliar,
  colaConciliarVacia,
  cuentas,
  MOV_USD,
  MOV_USD_REDONDO,
  sinClasificar,
  sinClasificarDolares,
  sinClasificarSinMoneda,
  sinClasificarVacio,
  cuentasRetiradasBice,
  sinCuentasRetiradas,
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

/** Las coincidencias que hay en el HTML (las pills `mut` del bloque Coincide en). */
function chips(h: string): string[] {
  const bloque = /Coincide en<\/span>([\s\S]*?)<\/p>/.exec(h);
  if (!bloque) return [];
  return [...bloque[1]!.matchAll(/<span class="[^"]*rediseno-neutro-bg[^"]*"[^>]*>([^<]*)</g)].map(
    (m) => m[1]!,
  );
}

describe("BandejaV07View — enlace a movimiento exacto", () => {
  it("muestra la segunda conciliación y no la primera al entrar por su enlace", () => {
    const t = texto(html({ tabInicial: "conciliar", movimientoInicial: MOV_VOLCAN }));
    expect(t).toContain("Conciliar 2 de 2");
    expect(t).toContain("ABONO TRANSFERENCIA MIRKO GONZALEZ");
    expect(t).not.toContain("TRANSFERENCIA DE COMERCIAL KAUFMANN");
  });

  it("muestra la segunda clasificación y no la primera al entrar por su enlace", () => {
    const t = texto(html({ tabInicial: "clasificar", movimientoInicial: MOV_TERCEROS }));
    expect(t).toContain("TRANSF. A TERCEROS VIA INTERNET");
    expect(t).not.toContain("PAGO SERVICIOS DATTATEC.COM");
  });
});

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
    expect(t).not.toContain("El progreso corresponde a esta sesión");
  });

  it("usa Sora en títulos y montos, Figtree en copy operativo y mono sólo en atajos", () => {
    const h = html();

    // El div raíz, no sólo el eyebrow, da Figtree a TODO el copy operativo de la pantalla.
    // El ancla de contenido evita que una clase en un contenedor vacío certifique el contrato.
    expect(h).toMatch(/<div class="space-y-4 font-rediseno-sans">[\s\S]*?<p[^>]*>Bandeja<\/p>/);
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
  it("muestra el avance sin explicar el motor", () => {
    expect(texto(html())).toContain("Conciliar 1 de 2");
    expect(texto(html())).not.toContain("requiere revisión:");
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

  /* B14 — la línea de diferencia ya NO agrega "El documento es de hace N días": convivía con el
     chip "a N días del documento" y eran dos relojes distintos en la misma tarjeta. La fecha del
     documento sigue completa en el bloque "Candidato". */
  it("la línea de diferencia dice que calza exacto, sin un segundo reloj al lado", () => {
    const t = texto(html());
    expect(t).toContain("El monto calza exacto con el documento.");
    expect(t).not.toContain("El documento es de hace");
    expect(t).toContain("5 ago 2026");
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
    expect(texto(h)).toContain("No hay coincidencia clara.");
    // Gemelo positivo con la MISMA query: el caso con evidencia sí trae chips.
    expect(chips(html())).toHaveLength(5);
  });

  it("el why enumera lo que falta, y la diferencia se muestra como parcialidad", () => {
    const t = texto(html(volcan()));
    expect(t).not.toContain("requiere revisión:");
    expect(t).toContain(
      "Pago parcial: entraron $1.033.076 de $1.063.341; quedan $30.265 por cobrar.",
    );
  });

  it("LEY 3 — NO ofrece 'Sí, conciliar': el primario manda a elegir el documento a mano", () => {
    const h = html(volcan());
    expect(texto(h)).toContain("Buscar el documento B");
    expect(h).not.toMatch(/>Sí, conciliar <span/);
    expect(texto(h)).toContain("Elige un documento o sáltalo.");
    // Gemelo: en el caso con evidencia ese texto NO está y el botón sí.
    expect(texto(html())).not.toContain("va a revisión manual");
    expect(html()).toMatch(/>Sí, conciliar <span/);
  });
});

describe("mensaje de asociación documental", () => {
  const conRut = CONCILIAR().find((item) => item.id === MOV_KAUFMANN)!;
  const sinRut = CONCILIAR().find((item) => item.id === MOV_VOLCAN)!;

  it("no afirma que falta RUT cuando la glosa sí lo contiene", () => {
    const message = mensajeSinSugerenciaConciliar(conRut, 1);
    expect(message).toContain("La glosa incluye un RUT");
    expect(message).not.toContain("no incluye un RUT");
  });

  it("distingue ausencia de RUT de ausencia de candidatos", () => {
    expect(mensajeSinSugerenciaConciliar(sinRut, 1)).toContain("no incluye un RUT");
    expect(mensajeSinSugerenciaConciliar(conRut, 0)).toContain("terminó sin documentos candidatos");
  });

  it("una consulta fallida se abstiene y no publica el detalle", () => {
    const message = mensajeSinSugerenciaConciliar(
      conRut,
      0,
      "Traceback SELECT token FROM users at /api/internal",
    );
    expect(message).toContain("No pudimos cargar los documentos candidatos");
    expect(message).toContain("no se considera vacía");
    expect(message).not.toContain("Traceback");
    expect(message).not.toContain("SELECT");
    expect(message).not.toContain("/api/");
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

  it("con regla: la sugerencia va primero, sin calificar su confianza", () => {
    const t = texto(html(conRegla()));
    expect(t).toContain("Clasificar 1 de 5 · Sugerencia disponible");
    expect(t).toContain("Cargo $89.250 · “PAGO SERVICIOS DATTATEC.COM 76888888-8” · 18 ago 2026");
    expect(t).toContain("Sugerido Software y tecnología · una regla tuya");
    expect(t).not.toMatch(/confianza|92%/i);
  });

  it("sin regla: NO hay sugerencia y aparecen 3 frecuentes rotulados como lo que son", () => {
    const t = texto(html(sinRegla()));
    expect(t).toContain("Clasificar 1 de 2 · Elige una categoría");
    expect(t).not.toContain("Sugerido");
    expect(t).toContain("Usadas recientemente:");
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

  it("el detalle opcional lleva notas sin explicación adicional", () => {
    const h = html(conRegla());
    const t = texto(h);
    expect(t).toContain("+ Agregar detalle (opcional)");
    expect(t).toContain("Nota para el contador");
    expect(t).not.toContain("Las vistas de gestión todavía no se asignan desde esta pantalla");
    expect(h).not.toContain(`href="/caja/por-clasificar?movimiento=${MOV_DATTATEC}"`);
  });

  it("no agrega una explicación antes de guardar", () => {
    const t = texto(html(conRegla()));
    expect(t).not.toContain("Al guardar no vas a ver “Deshacer”");
    expect(t).not.toContain("esta clasificación corresponde a una decisión manual");
    expect(t).not.toContain("Ley 5");
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
    expect(t).not.toContain("clasificaciones automáticas más");
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
    expect(t).toContain("No quedan movimientos por revisar.");
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
    expect(t).toContain("El conteo está incompleto. Reintenta en un momento.");
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
    expect(t).toContain("No podemos confirmar si existen tu bandeja de excepciones");
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

  it("no muestra el límite técnico de Deshacer en la pantalla principal", () => {
    const t = texto(html());
    expect(t).not.toContain("Las clasificaciones manuales y por lote no se pueden deshacer");
    expect(t).not.toContain("Revisa la selección antes de guardar");
    expect(t).not.toContain("Las acciones automáticas muestran Deshacer cuando sigue disponible");
    expect(t).not.toContain("Ley 5");
    expect(t).not.toContain("Sucesor");
    expect(t).not.toContain("#90");
  });
});

/* ── B04 · la moneda y los decimales son los de la CUENTA DE ORIGEN ───────────────────────────
 *
 * Hallazgo del QA E2E de Fernando contra producción (2026-10-05): en Bandeja los movimientos en
 * dólares se veían con signo de peso y sin decimales — `US$5.862,30` salía "$5.862". No es
 * cosmético: un monto en dólares rotulado en pesos es una cifra falsa, y a ~950 pesos por dólar
 * el error es de casi mil veces.
 *
 * Cada test va con SU GEMELO en pesos, porque un arreglo que ponga "US$" en todas partes pasa el
 * test del dólar y rompe el resto del producto. */

/* `texto()` ya colapsa el NBSP con el que `formatMoney` separa símbolo y cifra ("US$ 5.862,30"):
   ese separador es la regla ratificada, así que los asserts lo escriben tal cual. */

describe("BandejaV07View — moneda del movimiento (B04)", () => {
  it("un movimiento en dólares se muestra en dólares, con sus decimales", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        clasificar: itemsClasificar(sinClasificarDolares()),
        movimientoInicial: MOV_USD,
      }),
    );
    expect(t).toContain("US$ 5.862,30");
    // La cifra falsa de producción no puede volver a aparecer: "$5.862" sin la moneda.
    expect(t).not.toMatch(/(?<!US)\$5\.862(?!,)/);
  });

  it("GEMELO: dólares REDONDOS no pierden la moneda por venir sin centavos", () => {
    const t = texto(
      html({
        tabInicial: "clasificar",
        clasificar: itemsClasificar(sinClasificarDolares()),
        movimientoInicial: MOV_USD_REDONDO,
      }),
    );
    expect(t).toContain("US$ 5.344,00");
  });

  it("GEMELO: un movimiento en PESOS sigue en pesos y sin decimales", () => {
    const t = texto(html({ tabInicial: "clasificar", movimientoInicial: MOV_DATTATEC }));
    expect(t).toContain("$89.250");
    expect(t).not.toContain("US$");
    expect(t).not.toContain("89.250,00");
    expect(t).not.toContain("moneda no informada");
  });

  it("GEMELO: la conciliación en pesos conserva el peso en los DOS lados", () => {
    const t = texto(html({ tabInicial: "conciliar" }));
    expect(t).toContain("$2.380.000");
    expect(t).not.toContain("US$");
    expect(t).not.toContain("moneda no informada");
  });

  it("sin moneda declarada se dice que falta la moneda, no se inventa el peso", () => {
    const t = texto(
      html({ tabInicial: "clasificar", clasificar: itemsClasificar(sinClasificarSinMoneda()) }),
    );
    expect(t).toContain("moneda no informada");
    expect(t).not.toContain("$5.344");
  });
});

/* ── B12 · los verbos van segun la direccion del movimiento ───────────────────────────────────
 *
 * GEMELO DEL MUTANTE (a). Los dos bloques de abajo usan la MISMA aserción sobre la MISMA línea de
 * la tarjeta, con un abono y con un cargo. Si los verbos vuelven a ser fijos —da igual cuáles—
 * uno de los dos cae: "Entró"/"por cobrar" sobre un cargo de proveedor, o "Salió"/"por pagar"
 * sobre un abono de cliente. No hay copia fija que pase los dos.
 *
 * Importa porque es la mayoría: de los 755 movimientos de Tooxs medidos en producción el
 * 2026-10-05, 522 son cargos.
 */
describe("BandejaV07View — B12, verbos segun la direccion", () => {
  const cargos = () => itemsConciliar(colaConciliarCargos());

  function cargoParcial(): Partial<Props> {
    return {
      conciliar: cargos().filter((i) => i.id === MOV_CARGO_PARCIAL),
      candidatos: {
        movimientoId: MOV_CARGO_PARCIAL,
        lista: adaptarCandidatos(candidatosCargoParcial()),
        cargando: false,
      },
    };
  }

  function cargoExceso(): Partial<Props> {
    return {
      conciliar: cargos().filter((i) => i.id === MOV_CARGO_EXCESO),
      candidatos: {
        movimientoId: MOV_CARGO_EXCESO,
        lista: adaptarCandidatos(candidatosCargoExceso()),
        cargando: false,
      },
    };
  }

  it("un CARGO parcial deja saldo POR PAGAR, y la plata SALIÓ", () => {
    const t = texto(html(cargoParcial()));
    expect(t).toContain(
      "Pago parcial: salieron $1.000.000 de $1.005.171; quedan $5.171 por pagar.",
    );
    expect(t).not.toContain("por cobrar");
    expect(t).not.toContain("entraron");
  });

  it("un ABONO parcial deja saldo POR COBRAR, y la plata ENTRÓ (el gemelo del anterior)", () => {
    const t = texto(
      html({
        conciliar: CONCILIAR().filter((i) => i.id === MOV_VOLCAN),
        candidatos: {
          movimientoId: MOV_VOLCAN,
          lista: adaptarCandidatos(candidatosVolcan()),
          cargando: false,
        },
      }),
    );
    expect(t).toContain(
      "Pago parcial: entraron $1.033.076 de $1.063.341; quedan $30.265 por cobrar.",
    );
    expect(t).not.toContain("por pagar");
    expect(t).not.toContain("salieron");
  });

  it("un CARGO de más dice SALIÓ, no 'Entró' (el caso literal del QA: $183.801)", () => {
    const t = texto(html(cargoExceso()));
    expect(t).toContain("Salió $183.801 más que el documento");
    expect(t).not.toContain("Entró $183.801");
  });

  /* B14 — UNA sola referencia temporal por tarjeta. La línea de diferencia ya no agrega "El
     documento es de hace N días" al lado del chip "a N días del documento": medían cosas
     distintas y se leían como contradicción. La fecha del documento sigue entera en "Candidato". */
  it("B14 — la tarjeta no repite el tiempo: la fecha del documento va una sola vez y completa", () => {
    const t = texto(html(cargoParcial()));
    expect(t).not.toContain("El documento es de hace");
    expect(t).toContain("18 ago 2026");
  });
});

/* ---------------------------------------------------------------------------------------------
 * #1118 — lo que api#1126 sacó del listado tiene que VERSE.
 *
 * El defecto que estos tests cuidan no es el que se arregló, es el que el arreglo podía crear:
 * la API dejó de servir los movimientos de cuentas RETIRADAS (417 medidos en la BICE duplicada
 * de #1007), y si la pantalla no los nombra, 417 filas desaparecen sin que nadie lo diga.
 *
 * Cada afirmación va con su gemelo: el caso que DEBE dar otra cosa. Sin el gemelo, un componente
 * que imprimiera siempre la misma frase —o que no imprimiera nunca nada— pasaría igual.
 * --------------------------------------------------------------------------------------------- */
describe("BandejaV07View — cuentas retiradas (#1118)", () => {
  const EN_CLASIFICAR: Partial<Props> = { tabInicial: "clasificar" };

  it("(a) con 417 movimientos fuera, la pantalla LO DICE", () => {
    const t = texto(html({ ...EN_CLASIFICAR, cuentasRetiradas: cuentasRetiradasBice() }));
    expect(t).toContain("417 movimientos de 2 cuentas retiradas quedan fuera de este listado");
    expect(t).toContain("del 02-01-2026 al 08-09-2026");
    expect(t).toContain("Siguen guardados: no se borró nada.");
  });

  it("(a-gemelo) sin el dato (el listado no llegó) NO inventa un aviso", () => {
    /* `null` es "no sabemos", y de no saber no se afirma nada — ni que falta algo ni que no.
       Es el único caso en que callar es correcto. */
    const t = texto(html({ ...EN_CLASIFICAR, cuentasRetiradas: null }));
    expect(t).not.toContain("cuenta retirada");
    expect(t).not.toContain("cuentas retiradas");
    expect(t).not.toContain("quedan fuera de este listado");
  });

  it("(b) con 0 movimientos fuera, la pantalla NO afirma que falte nada", () => {
    const t = texto(html({ ...EN_CLASIFICAR, cuentasRetiradas: sinCuentasRetiradas() }));
    expect(t).not.toContain("quedan fuera de este listado");
    expect(t).not.toContain("417");
    expect(t).not.toMatch(/\bqueda(ron)? fuera\b/);
  });

  it("(b-gemelo) con 0 movimientos fuera TAMPOCO calla: el cero se publica como cifra", () => {
    /* El gemelo que hace al test (b) valer algo. Si la pantalla sólo pintara el campo cuando
       hay algo fuera, el caso cero quedaría indistinguible de una pantalla que ni siquiera lo
       mira — que es el defecto que #1118 vino a cerrar. Cero NO es "no hay dato". */
    const t = texto(html({ ...EN_CLASIFICAR, cuentasRetiradas: sinCuentasRetiradas() }));
    expect(t).toContain("Ninguna cuenta retirada aporta movimientos a este listado.");
  });

  it("(c) la leyenda que se muestra es la del BACKEND: si el backend cambia, la pantalla cambia", () => {
    /* El frontend no reescribe una verdad que el backend ya publica. Este test cambia el texto
       del backend por uno que ningún código de este repo podría construir y exige verlo tal cual:
       si alguien reemplazara `leyenda` por una frase armada acá con los números, fallaría. */
    const otraLeyenda =
      "Nueve movimientos de una cuenta retirada quedaron afuera; el backend lo dirá así mañana.";
    const t = texto(
      html({
        ...EN_CLASIFICAR,
        cuentasRetiradas: { ...cuentasRetiradasBice(), leyenda: otraLeyenda },
      }),
    );
    expect(t).toContain(otraLeyenda);
  });

  it("(c-gemelo) cambiada la leyenda del backend, la vieja YA NO aparece", () => {
    /* Sin este gemelo, una pantalla que imprimiera las dos —la del backend y una propia—
       pasaría el test (c). Las cifras siguen siendo 417 y 2: si la pantalla las reconstruyera
       por su cuenta, la frase vieja seguiría ahí. */
    const t = texto(
      html({
        ...EN_CLASIFICAR,
        cuentasRetiradas: { ...cuentasRetiradasBice(), leyenda: "Otra frase del productor." },
      }),
    );
    expect(t).toContain("Otra frase del productor.");
    expect(t).not.toContain("quedan fuera de este listado");
    expect(t).not.toContain("Siguen guardados: no se borró nada.");
  });

  it("(d) con la bandeja VACÍA también lo dice: no se celebra sobre 417 desaparecidos", () => {
    /* "Nada espera tu decisión" con 417 movimientos afuera es sencillamente falso, y el estado
       celebratorio es donde más cara sale una desaparición muda. */
    const t = texto(
      html({
        conciliar: itemsConciliar(colaConciliarVacia()),
        clasificar: itemsClasificar(sinClasificarVacio()),
        cuentasRetiradas: cuentasRetiradasBice(),
      }),
    );
    expect(t).toContain("Nada espera tu decisión");
    expect(t).toContain("417 movimientos de 2 cuentas retiradas quedan fuera de este listado");
  });

  it("(d-gemelo) con la bandeja vacía y nada fuera, el cero también se publica", () => {
    const t = texto(
      html({
        conciliar: itemsConciliar(colaConciliarVacia()),
        clasificar: itemsClasificar(sinClasificarVacio()),
        cuentasRetiradas: sinCuentasRetiradas(),
      }),
    );
    expect(t).toContain("Nada espera tu decisión");
    expect(t).toContain("Ninguna cuenta retirada aporta movimientos a este listado.");
    expect(t).not.toContain("quedan fuera de este listado");
  });
});
