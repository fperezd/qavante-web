import { describe, expect, it } from "vitest";
import { anilloDelPulso } from "./pulso-ring-model";
import {
  PULSO_SIN_DATO_LABEL,
  pulsoSinDato,
  pulsoStatusDotBg,
  pulsoStatusLabel,
  pulsoStatusTone,
} from "./dashboard-format";
import { resolvePulsoPresentation } from "../gestion/v2/pulso-status";

/* Los publicadores del estado del Pulso que son función pura, en un solo archivo.
 *
 * Una versión anterior de este comentario decía "TODOS los publicadores", y era **falso cuando
 * se escribió**: `shell/header.tsx` y `inicio/v2/pulso-card.tsx` no tenían una sola aserción, y
 * el pase §6 encontró cinco mutantes vivos ahí — dos de ellos reponiendo el verde con
 * `status: null`, que es el defecto exacto que este PR cierra. Cubrirlos costó extraer
 * `shell/pulso-badge-model.ts` (con su propio test) y dos stories con `play` en `PulsoCard`.
 *
 * El defecto (qavante-api#162) no fue escribir mal un componente: fue que la afirmación "cuando
 * no sé, digo Estable" vivía en CINCO superficies y la primera corrección arregló una.
 *
 * El pase §6 lo midió: con el anillo ya diciendo "Sin datos", la barra superior —que sale en
 * TODAS las pantallas y lee el MISMO objeto— seguía diciendo " · Estable", con el `aria-label`
 * "Pulso de tu empresa: de 100, Estable".
 *
 * Por eso este archivo agrupa por AFIRMACIÓN y no por componente: si mañana aparece un sexto
 * publicador, el lugar donde falta el test es evidente. Los que no son función pura tienen su
 * cobertura donde corresponde — `shell/pulso-badge-model.test.ts` y las stories con `play` de
 * `PulsoCard`, `PulsoRing` y `PulsoTira`, que CI corre como gate (`npm run test:storybook`).
 *
 * La versión anterior de esta lista NO nombraba a `PulsoTira`, que este PR también modificó: el
 * puntero decía dónde mirar y omitía justo el publicador recién tocado. Tercera vuelta del mismo
 * defecto, tercera superficie. */

describe("cuando la API se abstiene, ningún publicador dice una palabra tranquilizadora", () => {
  it("el formateador compartido (barra superior, /alertas)", () => {
    expect(pulsoStatusLabel(null)).toBe(PULSO_SIN_DATO_LABEL);
    expect(pulsoStatusLabel(null)).not.toBe("Estable");
    expect(pulsoStatusLabel(undefined)).toBe(PULSO_SIN_DATO_LABEL);
  });

  it("el anillo del Inicio", () => {
    expect(anilloDelPulso(null, null).label).toBe("Sin datos");
    expect(anilloDelPulso(null, null).label).not.toBe("Estable");
  });

  it("la tira de Gestión", () => {
    const p = resolvePulsoPresentation(null);
    expect(p.known).toBe(false);
    expect(p.estado).not.toContain("estable");
    expect(p.estado).toContain("sin datos");
  });
});

describe("y ninguno lo pinta de verde", () => {
  /* El mutante que sobrevivió al primer pase: el PR dedicaba dos párrafos a "neutro y no rojo,
   * a propósito" y el color del estado sin-dato no lo aseguraba ningún test — se podía volver
   * verde con la suite entera en verde. */

  it("el anillo no usa un color de éxito", () => {
    const a = anilloDelPulso(null, null);
    expect(a.color).toBe("var(--color-neutral-mid)");
    expect(a.color).not.toContain("success");
    expect(a.color).not.toContain("danger");
    expect(a.textClass).not.toContain("success");
  });

  it("la tira de Gestión tampoco — y el `tono` es el campo que faltaba", () => {
    // El commit anterior cambió este `tono` de "warn" a "neutral", lo argumentó en dos
    // comentarios, una sección del commit y un párrafo del cuerpo del PR — y no lo afirmó
    // ningún test. Mutarlo a "ok" pintaba el chip y el número en VERDE DE ÉXITO sobre el texto
    // "Pulso sin datos suficientes para calcularlo", con los 1607+657 tests en verde.
    //
    // Es el mismo defecto que este archivo existe para cerrar, en el publicador que se tocó de
    // paso. Sexta superficie.
    expect(resolvePulsoPresentation(null).tono).toBe("neutral");
    expect(resolvePulsoPresentation(null).tono).not.toBe("ok");
  });

  it("el tono y el punto del formateador tampoco", () => {
    expect(pulsoStatusTone(null)).toBe("text-neutral-mid");
    expect(pulsoStatusTone(null)).not.toContain("success");
    expect(pulsoStatusDotBg(null)).toBe("bg-neutral-mid");
    expect(pulsoStatusDotBg(null)).not.toContain("success");
  });

  it("NEUTRO, no rojo: 'no sabemos' tampoco es 'está mal'", () => {
    // El error simétrico. Inventar una mala noticia es tan mentira como inventar una buena, y
    // además entrena a ignorar la alarma.
    expect(pulsoStatusTone(null)).not.toContain("danger");
    expect(pulsoStatusDotBg(null)).not.toContain("danger");
    expect(anilloDelPulso(null, null).textClass).not.toContain("danger");
  });
});

describe("EL CONTRAPESO: con un estado real, todos se pronuncian", () => {
  /* Sin este bloque, "no inventes" se satisface no diciendo nunca nada — y el Pulso es el
   * indicador de portada. Cada aserción negativa de arriba tiene acá su gemela positiva con el
   * MISMO valor. */

  it("el formateador dice la palabra y el color de cada estado", () => {
    expect(pulsoStatusLabel("stable")).toBe("Estable");
    expect(pulsoStatusLabel("critical")).toBe("Crítica");
    expect(pulsoStatusTone("strong")).toContain("success");
    expect(pulsoStatusTone("critical")).toContain("danger");
    expect(pulsoStatusDotBg("strong")).toContain("success");
    expect(pulsoStatusDotBg("critical")).toContain("danger");
  });

  it("el anillo también", () => {
    expect(anilloDelPulso(78, "stable").label).toBe("Estable");
    expect(anilloDelPulso(78, "stable").textClass).toContain("success");
    expect(anilloDelPulso(12, "critical").textClass).toContain("danger");
  });

  it("y la tira reconoce el estado como conocido, con SU tono", () => {
    expect(resolvePulsoPresentation("stable").known).toBe(true);
    expect(resolvePulsoPresentation("stable").estado).toBe("Pulso estable");
    // La gemela del negativo de arriba, con el MISMO campo: un estado real SÍ tiene tono
    // semántico. Sin este par, "no pintes de éxito" se cumple no pintando nunca de éxito.
    expect(resolvePulsoPresentation("stable").tono).toBe("warn");
    expect(resolvePulsoPresentation("strong").tono).toBe("ok");
    expect(resolvePulsoPresentation("critical").tono).toBe("bad");
  });
});

describe("un valor FUERA DE CONTRATO es otra cosa, y su fallback se conserva", () => {
  /* La distinción es el corazón del arreglo. `null` es el backend diciendo "no sé"; un string
   * inesperado es el backend adelantándose al front. Meterlos en el mismo cajón fue el defecto.
   * Este bloque fija que el segundo caso NO cambió. */

  it("el formateador sigue cayendo en 'Estable' para un string desconocido", () => {
    expect(pulsoStatusLabel("un_estado_que_no_existe")).toBe("Estable");
    expect(pulsoSinDato("un_estado_que_no_existe")).toBe(false);
  });

  it("la tira lo distingue del 'no sé' declarado", () => {
    const desconocido = resolvePulsoPresentation("un_estado_que_no_existe");
    const abstenido = resolvePulsoPresentation(null);

    expect(desconocido.known).toBe(false);
    expect(abstenido.known).toBe(false);
    expect(desconocido.estado).not.toBe(abstenido.estado);
    expect(desconocido.estado).toContain("pendiente de actualizar");
  });
});

describe("pulsoSinDato distingue el 'no sé' de todo lo demás", () => {
  it("es true sólo para null y undefined", () => {
    expect(pulsoSinDato(null)).toBe(true);
    expect(pulsoSinDato(undefined)).toBe(true);
    expect(pulsoSinDato("stable")).toBe(false);
    expect(pulsoSinDato("critical")).toBe(false);
    // El string vacío NO es el "no sé" declarado: es un valor inesperado.
    expect(pulsoSinDato("")).toBe(false);
  });
});
