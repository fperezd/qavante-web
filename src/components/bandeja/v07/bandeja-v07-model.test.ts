import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type {
  RevertActionResponse,
  ReversibleActionsListResponse,
} from "@/lib/api/reversible-actions";
import {
  accionesAutoClasificar,
  agruparAlFrente,
  candidatoElegido,
  candidatos,
  claveContraparte,
  cuentaDestinoEnTexto,
  diasEntre,
  direccionDeKind,
  evidenciaConciliar,
  faltaParaGuardar,
  folioEnGlosa,
  frecuentes,
  bloqueoConciliar,
  avisoDeFallo,
  haySugerenciaConciliar,
  interpretarDeshacer,
  itemsClasificar,
  itemsConciliar,
  lote,
  montoCalza,
  montosResueltos,
  textoResuelto,
  monedaDeContrato,
  motivosNoAutomatico,
  nombreEnGlosa,
  normalizarRut,
  parcialidad,
  primerRutEnTexto,
  progreso,
  rutEnGlosa,
  rutsEnTexto,
  sugerenciaCategoria,
  trasResolver,
  trasSaltar,
  type ItemClasificarV07,
  type OpcionCuentaV07,
} from "./bandeja-v07-model";
import {
  CUENTA_ARRIENDO,
  CUENTA_HONORARIOS,
  CUENTA_REMUNERACIONES,
  CUENTA_SOFTWARE,
  MOV_DATTATEC,
  MOV_ENTEL_1,
  MOV_EXCEDE,
  MOV_KAUFMANN,
  MOV_TERCEROS,
  candidatosExcede,
  candidatosKaufmann,
  candidatosVolcan,
  categoriaSinSugerencia,
  categoriaSugeridaDattatec,
  clasificados,
  colaConciliar,
  colaConciliarExcede,
  sinClasificar,
} from "./bandeja-v07-fixtures";

/* V07 · Bandeja — el modelo puro, sin DOM.
 *
 * El eje del archivo es la LEY 3: acá se fija, con números, que un chip sólo existe si su
 * verificación pasó y que sin RUT en la glosa Y sin monto que calce NO hay sugerencia. Cada
 * negativo lleva su gemelo positivo con la MISMA función, para que un assert no pueda pasar por
 * estar mal escrito. */

const KAUFMANN = () => itemsConciliar(colaConciliar())[0]!;
const VOLCAN = () => itemsConciliar(colaConciliar())[1]!;
const CAND_KAUFMANN = () => candidatos(candidatosKaufmann())[0]!;
const CAND_VOLCAN = () => candidatos(candidatosVolcan())[0]!;
const EXCEDE = () => itemsConciliar(colaConciliarExcede())[0]!;
const CAND_EXCEDE = () => candidatos(candidatosExcede())[0]!;

describe("normalización de RUT y texto", () => {
  it("normaliza con y sin puntos, y encuentra el RUT dentro de una glosa", () => {
    expect(normalizarRut("96.572.360-9")).toBe("965723609");
    expect(normalizarRut("96572360-9")).toBe("965723609");
    expect(normalizarRut("76.888.888-k")).toBe("76888888K");
    expect(normalizarRut("")).toBeNull();
    expect(rutsEnTexto("TRANSFERENCIA 96.572.360-9 FAC 435")).toEqual(["965723609"]);
    expect(primerRutEnTexto("ABONO TRANSFERENCIA MIRKO GONZALEZ")).toBeNull();
  });

  it("F. Jaña: no confunde la cuenta destino con RUT y prioriza el RUT rotulado", () => {
    const glosa =
      "Transf. a terceros vía Internet a cuenta 32667051 B.BCI, IGNACIO MATIAS JANA, Rut 18.974.184-7, el 04-09-2026";

    expect(cuentaDestinoEnTexto(glosa)).toBe("32667051");
    expect(rutsEnTexto(glosa)).toEqual(["189741847"]);
    expect(primerRutEnTexto(glosa)).toBe("189741847");
  });

  it("acepta un RUT sin etiqueta sólo si tiene separador y rechaza un número desnudo", () => {
    expect(primerRutEnTexto("TEF desde 77078244-9 concepto 404579")).toBe("770782449");
    expect(primerRutEnTexto("TRANSFERENCIA A CUENTA 32667051")).toBeNull();
  });

  it("cuenta días civiles entre fechas ISO, y dice 'no sé' con basura", () => {
    expect(diasEntre("2026-08-05", "2026-08-26")).toBe(21);
    expect(diasEntre("2026-08-19", "2026-04-14")).toBe(-127);
    expect(diasEntre("Sin información", "2026-08-26")).toBeNull();
    expect(diasEntre("2026-13-01", "2026-08-26")).toBeNull();
  });
});

describe("adaptadores de contrato", () => {
  it("la cola de conciliación llega sin dirección: se deriva del kind del documento", () => {
    // La cola (`ReviewItem`) NO trae `direction`; `receivable` = entra plata.
    expect(direccionDeKind("receivable")).toBe("credit");
    expect(direccionDeKind("payable")).toBe("debit");
    // Gemelo del "no sé": un kind desconocido NO se resuelve a un default plausible.
    expect(direccionDeKind("cualquier_cosa")).toBeNull();
    expect(direccionDeKind(null)).toBeNull();
    expect(KAUFMANN().direccion).toBe("credit");
  });

  it("los ítems de conciliar traen monto en magnitud, glosa y el documento propuesto", () => {
    const k = KAUFMANN();
    expect(k.id).toBe(MOV_KAUFMANN);
    expect(k.monto).toBe(2380000);
    expect(k.documentoPropuesto).toBe("doc-435");
    expect(k.scoreMotor).toBe(78);
    expect(k.documentos).toBe(1);
  });

  it("los ítems de clasificar sacan el RUT de la glosa cuando lo hay, y null cuando no", () => {
    const items = itemsClasificar(sinClasificar());
    const dattatec = items.find((i) => i.id === MOV_DATTATEC)!;
    const terceros = items.find((i) => i.id === MOV_TERCEROS)!;
    expect(dattatec.rutGlosa).toBe("768888888");
    expect(dattatec.monto).toBe(89250);
    expect(dattatec.direccion).toBe("debit");
    // Gemelo: la MISMA propiedad es null cuando la glosa no trae RUT.
    expect(terceros.rutGlosa).toBeNull();
  });

  it("usa cuenta destino antes que RUT como clave, igual que el backend", () => {
    const base = itemsClasificar(sinClasificar())[0]!;
    const item = {
      ...base,
      glosa: "a cuenta 32667051, Rut 18.974.184-7",
      cuentaDestino: "32667051",
      rutGlosa: "189741847",
    };

    expect(claveContraparte(item)).toBe("cuenta:32667051");
  });

  it("conserva la cuenta ya guardada de un movimiento parcial para completar sólo lo faltante", () => {
    const resp = sinClasificar([MOV_DATTATEC]);
    resp.items[0] = {
      ...resp.items[0]!,
      management_account_id: CUENTA_SOFTWARE,
      canonical_category: null,
      classification_status: "partially_classified",
    };

    expect(itemsClasificar(resp)[0]).toMatchObject({
      cuentaIdActual: CUENTA_SOFTWARE,
      categoriaCanonicaActual: null,
    });
  });

  it("los candidatos se ordenan por score descendente", () => {
    expect(candidatos(candidatosKaufmann()).map((c) => c.score)).toEqual([78, 41]);
    expect(candidatos(null)).toEqual([]);
  });

  it("elige el documento del motor; si el usuario eligió otro, gana el del usuario", () => {
    const lista = candidatos(candidatosKaufmann());
    expect(candidatoElegido(lista, "doc-435", null)?.documentId).toBe("doc-435");
    expect(candidatoElegido(lista, "doc-435", "doc-428")?.documentId).toBe("doc-428");
    // El propuesto ya no está en la lista → cae al de mejor score, no a undefined.
    expect(candidatoElegido(lista, "doc-999", null)?.documentId).toBe("doc-435");
    expect(candidatoElegido([], "doc-435", null)).toBeNull();
  });
});

describe("LEY 3 — las verificaciones que pasan, y sólo esas", () => {
  it("Kaufmann: RUT, folio, nombre, monto exacto y fecha a 21 días ⇒ CINCO chips", () => {
    const chips = evidenciaConciliar(KAUFMANN(), CAND_KAUFMANN());
    expect(chips.map((c) => c.id)).toEqual([
      "rut-en-glosa",
      "folio-en-glosa",
      "nombre-en-glosa",
      "monto-exacto",
      "fecha-cercana",
    ]);
    expect(chips.map((c) => c.texto)).toEqual([
      "RUT en la glosa",
      "folio 435 en la glosa",
      "el nombre de la contraparte en la glosa",
      "monto exacto",
      "a 21 días del documento",
    ]);
  });

  it("Volcán: ninguna verificación pasa ⇒ CERO chips (no un chip que diga 'no calza')", () => {
    // El caso del HTML de referencia: pagador ≠ cliente, −$30.265 y fecha lejana.
    const chips = evidenciaConciliar(VOLCAN(), CAND_VOLCAN());
    expect(chips).toEqual([]);
    // Y una a una, con la MISMA función que da los chips positivos arriba:
    expect(rutEnGlosa(VOLCAN().glosa, CAND_VOLCAN().rut)).toBe(false);
    expect(folioEnGlosa(VOLCAN().glosa, CAND_VOLCAN().folio)).toBe(false);
    expect(nombreEnGlosa(VOLCAN().glosa, CAND_VOLCAN().nombre)).toBe(false);
    expect(montoCalza(VOLCAN(), CAND_VOLCAN())).toBe(false);
  });

  it("sin candidato no hay chips ni sugerencia: no se inventa evidencia de la nada", () => {
    expect(evidenciaConciliar(KAUFMANN(), null)).toEqual([]);
    expect(haySugerenciaConciliar(KAUFMANN(), null)).toBe(false);
  });

  it("la compuerta: sin RUT en glosa Y sin monto que calce → NO hay sugerencia", () => {
    expect(haySugerenciaConciliar(VOLCAN(), CAND_VOLCAN())).toBe(false);
    // Gemelo positivo, misma función: con RUT y monto exacto, SÍ hay.
    expect(haySugerenciaConciliar(KAUFMANN(), CAND_KAUFMANN())).toBe(true);
  });

  it("basta UNA de las dos: sólo monto (sin RUT) alcanza, y sólo RUT (sin monto) también", () => {
    /* Esta prueba es sobre la mitad de EVIDENCIA de la compuerta, así que la autorización del
       servidor se mantiene fija en `true`: si no, mide las dos cosas a la vez y no se sabe cuál
       falló. El fixture del Volcán trae `can_confirm: false`, que es su propio caso más abajo. */
    const autorizado = { ...VOLCAN(), puedeConfirmar: true };
    const soloMonto = { ...autorizado, glosa: "ABONO TRANSFERENCIA MIRKO GONZALEZ" };
    const candCalza = { ...CAND_VOLCAN(), monto: 1033076 };
    expect(haySugerenciaConciliar(soloMonto, candCalza)).toBe(true);
    const soloRut = { ...autorizado, glosa: "ABONO 81.201.000-K MIRKO GONZALEZ" };
    expect(haySugerenciaConciliar(soloRut, CAND_VOLCAN())).toBe(true);
  });

  /* ── La compuerta del servidor: `can_confirm` / `confirmable` ───────────────────────────── */

  it("EL CASO DE LA CAPTURA: evidencia que pasa + servidor que dice no ⇒ no se ofrece el botón", () => {
    const item = EXCEDE();
    const cand = CAND_EXCEDE();
    /* La mitad de evidencia PASA: el RUT está en la glosa. Antes eso solo bastaba, y por eso el
       botón se ofrecía y el backend respondía 409 siempre. */
    expect(rutEnGlosa(item.glosa, cand.rut)).toBe(true);
    // Y ahora igual no se ofrece, porque la autorización es del servidor.
    expect(item.puedeConfirmar).toBe(false);
    expect(cand.confirmable).toBe(false);
    expect(haySugerenciaConciliar(item, cand)).toBe(false);
  });

  it("gemelo: con la MISMA evidencia y el servidor autorizando, el botón sí se ofrece", () => {
    const item = { ...EXCEDE(), puedeConfirmar: true };
    const cand = { ...CAND_EXCEDE(), confirmable: true, bloqueo: null };
    expect(haySugerenciaConciliar(item, cand)).toBe(true);
  });

  it("basta que el CANDIDATO no sea confirmable, aunque la propuesta del motor lo fuera", () => {
    // El dueño puede cambiar de documento: manda el candidato que está mirando.
    const item = { ...KAUFMANN(), puedeConfirmar: true };
    const cand = { ...CAND_KAUFMANN(), confirmable: false };
    expect(haySugerenciaConciliar(item, cand)).toBe(false);
  });

  it("sin `can_confirm` en la respuesta NO se ofrece: el default honesto es no conciliar", () => {
    const sinCampo = itemsConciliar({
      items: [
        {
          movement_id: "mov-viejo",
          date: "2026-08-01",
          amount: "1000",
          description: "ABONO 81.201.000-K",
          suggestion: {
            document_kind: "receivable",
            document_id: "doc-1",
            name: "Alguien",
            score: "80",
            document_count: 1,
            bulk_eligible: false,
            topology: "1:1",
          },
        },
      ],
      count: 1,
    } as unknown as Parameters<typeof itemsConciliar>[0])[0]!;
    expect(sinCampo.puedeConfirmar).toBe(false);
    expect(haySugerenciaConciliar(sinCampo, { ...CAND_VOLCAN(), rut: "81201000K" })).toBe(false);
  });

  it("el bloqueo que se muestra es el del servidor, con el monto adentro", () => {
    const bloqueo = bloqueoConciliar(EXCEDE(), CAND_EXCEDE());
    expect(bloqueo?.codigo).toBe("movement_exceeds_document");
    expect(bloqueo?.mensaje).toContain("$380.000");
    expect(bloqueo?.reintentable).toBe(false);
    // Sin bloqueo no se inventa uno.
    expect(bloqueoConciliar({ ...KAUFMANN(), puedeConfirmar: true }, CAND_KAUFMANN())).toBeNull();
  });

  /* LOS QUE NO TIENEN DOCUMENTO PROPUESTO (43 de los 72 medidos en producción).
     Ahí "actualiza la cola" también sería mentira: no hay nada que refrescar, hay que elegir el
     documento a mano. Sin candidato la compuerta ya era `false`, así que el botón nunca se
     ofrecía; lo que cambia es que ahora, si la cola manda el blocker, se dice POR QUÉ. */
  it("sin documento propuesto se muestra el motivo del servidor, y no se promete refrescar", () => {
    const sinDoc = {
      ...EXCEDE(),
      documentoPropuesto: null,
      bloqueo: {
        codigo: "no_document_suggested",
        mensaje: "No encontramos un documento que calce con este movimiento.",
        reintentable: false,
      },
    };
    // Sin candidato no hay sugerencia, con blocker o sin él.
    expect(haySugerenciaConciliar(sinDoc, null)).toBe(false);
    const bloqueo = bloqueoConciliar(sinDoc, null);
    expect(bloqueo?.codigo).toBe("no_document_suggested");
    expect(bloqueo?.reintentable).toBe(false);
  });

  /* ── El aviso de un fallo: nunca prometer un reintento que no puede funcionar ───────────── */

  it("409 no reintentable: dice el motivo del servidor y NO manda a reintentar", () => {
    const err = new ApiError("Conflicto.", 409, "movement_exceeds_document", {
      code: "movement_exceeds_document",
      message: "El movimiento supera en $380.000 el saldo del documento.",
      retryable: false,
    });
    const aviso = avisoDeFallo("conciliar este movimiento", err);
    expect(aviso).toContain("$380.000");
    expect(aviso).not.toContain("vuelve a intentar");
    expect(aviso).not.toContain("Vuelve a intentar");
  });

  it("gemelo: con `retryable: true` SÍ manda a reintentar, con el mismo motivo", () => {
    const err = new ApiError("Conflicto.", 409, "stale_suggestion", {
      code: "stale_suggestion",
      message: "La sugerencia quedó vieja.",
      retryable: true,
    });
    const aviso = avisoDeFallo("conciliar este movimiento", err);
    expect(aviso).toContain("La sugerencia quedó vieja.");
    expect(aviso).toContain("Vuelve a intentar.");
  });

  it("el bloqueo también se lee cuando viaja bajo `detail`", () => {
    const err = new ApiError("Conflicto.", 409, "document_settled", {
      detail: { code: "document_settled", message: "El documento ya se saldó.", retryable: false },
    });
    expect(avisoDeFallo("conciliar este movimiento", err)).toContain("ya se saldó");
  });

  it("corte de red y 5xx: ahí reintentar sí tiene sentido", () => {
    const red = new ApiError("Error de red.", 0, "network_error");
    expect(avisoDeFallo("conciliar este movimiento", red)).toContain("vuelve a intentar");
    const servidor = new ApiError("Boom.", 500, "internal");
    expect(avisoDeFallo("conciliar este movimiento", servidor)).toContain("vuelve a intentar");
  });

  it("sin motivo legible NO se promete nada: se dice el estado y se calla", () => {
    const err = new ApiError("Conflicto.", 409, "algo_raro");
    const aviso = avisoDeFallo("conciliar este movimiento", err);
    expect(aviso).toBe("No pudimos conciliar este movimiento. El movimiento sigue pendiente.");
    expect(aviso).not.toContain("intentar");
  });

  /* LA MEDICIÓN QUE IMPORTA: cuántos botones se ofrecen antes y después, sobre la misma cola.
     "Antes" se reconstruye con la compuerta vieja (sólo evidencia), que es lo que el front hacía;
     "después" es la función de verdad. */
  it("cuántos botones se retiran: los que la evidencia aprobaba y el servidor rechaza", () => {
    const cola = [
      { item: KAUFMANN(), cand: CAND_KAUFMANN() },
      { item: VOLCAN(), cand: CAND_VOLCAN() },
      { item: EXCEDE(), cand: CAND_EXCEDE() },
    ];
    const compuertaVieja = ({ item, cand }: (typeof cola)[number]) =>
      rutEnGlosa(item.glosa, cand.rut) || montoCalza(item, cand);
    const antes = cola.filter(compuertaVieja).length;
    const despues = cola.filter(({ item, cand }) => haySugerenciaConciliar(item, cand)).length;
    expect(antes).toBe(2); // Kaufmann (RUT + monto) y Andina (RUT en la glosa)
    expect(despues).toBe(1); // sólo Kaufmann: el servidor autoriza uno
    // Y el que se retira es exactamente el que el backend rechazaría con 409.
    const retirados = cola.filter(
      (c) => compuertaVieja(c) && !haySugerenciaConciliar(c.item, c.cand),
    );
    expect(retirados.map((c) => c.item.id)).toEqual([MOV_EXCEDE]);
  });

  it("la tolerancia de ±1 % es del documento: $10.633 de $1.063.341 calza, $30.265 no", () => {
    const cand = CAND_VOLCAN(); // $1.063.341
    const dentro = { ...VOLCAN(), monto: 1_063_341 - 10_000 };
    const fuera = { ...VOLCAN(), monto: 1_063_341 - 30_265 };
    expect(montoCalza(dentro, cand)).toBe(true);
    expect(montoCalza(fuera, cand)).toBe(false);
    // El chip de esa banda es OTRO chip, no el de "monto exacto".
    expect(evidenciaConciliar(dentro, cand).map((c) => c.id)).toContain("monto-en-tolerancia");
    expect(evidenciaConciliar(dentro, cand).map((c) => c.id)).not.toContain("monto-exacto");
  });

  it("un folio de 1-2 dígitos no cuenta como evidencia (matchearía cualquier cosa)", () => {
    expect(folioEnGlosa("PAGO 12 CUOTAS", "12")).toBe(false);
    // Gemelo positivo con la MISMA función: tres dígitos sí.
    expect(folioEnGlosa("PAGO FAC 123", "123")).toBe(true);
    expect(folioEnGlosa("PAGO FAC 1234", "123")).toBe(false);
  });

  it("el cuerpo del RUT (sin DV) dentro de un número de operación más largo NO es evidencia", () => {
    // Caso del reviewer: cuerpo del RUT "96572360" cabe entero dentro del número de operación
    // "001965723601" — sin frontera de dígito, `includes` lo daba por bueno.
    const glosa = "TRANSFERENCIA OP 001965723601 DE UN TERCERO";
    const candSinCalce = { ...CAND_VOLCAN(), rut: "96.572.360-9" };
    expect(rutEnGlosa(glosa, candSinCalce.rut)).toBe(false);
    const itemSinCalce = { ...VOLCAN(), glosa, monto: (candSinCalce.monto ?? 0) - 500_000 };
    expect(haySugerenciaConciliar(itemSinCalce, candSinCalce)).toBe(false);
    expect(evidenciaConciliar(itemSinCalce, candSinCalce).map((c) => c.id)).not.toContain(
      "rut-en-glosa",
    );
    // Gemelo positivo con la MISMA función: el mismo cuerpo, pero con frontera de dígito
    // (el DV truncado por el banco), sí es evidencia.
    const glosaTruncada = "TRANSFERENCIA 96572360 DE UN TERCERO";
    expect(rutEnGlosa(glosaTruncada, candSinCalce.rut)).toBe(true);
  });

  it("las palabras genéricas del nombre no son evidencia; una distintiva sí", () => {
    expect(nombreEnGlosa("PAGO SOCIEDAD COMERCIAL LIMITADA", "Comercial Andes Limitada")).toBe(
      false,
    );
    expect(nombreEnGlosa("PAGO A KAUFMANN", "Comercial Kaufmann S.A.")).toBe(true);
  });
});

describe("por qué no lo resolvió solo, y la línea de diferencia", () => {
  it("Volcán: enumera las verificaciones que faltan sin exponer términos internos", () => {
    expect(motivosNoAutomatico(VOLCAN(), CAND_VOLCAN())).toEqual([
      "el monto no calza exacto",
      "el RUT no aparece en la glosa",
      "la fecha está lejos",
    ]);
  });

  it("Kaufmann: no falta ninguna verificación ⇒ el motivo es el umbral del motor", () => {
    expect(motivosNoAutomatico(KAUFMANN(), CAND_KAUFMANN())).toEqual([
      "requiere confirmación manual",
    ]);
  });

  it("parcialidad: $1.033.076 contra $1.063.341 ⇒ quedan $30.265 por cobrar", () => {
    expect(parcialidad(VOLCAN(), CAND_VOLCAN())).toEqual({
      tipo: "parcial",
      monto: 30265,
      restante: 30265,
    });
    expect(parcialidad(KAUFMANN(), CAND_KAUFMANN())).toEqual({ tipo: "exacta" });
    expect(parcialidad(KAUFMANN(), null)).toEqual({ tipo: "sin-candidato" });
    // Documento sin monto usable → NO se calcula una diferencia falsa contra cero.
    expect(parcialidad(KAUFMANN(), { ...CAND_KAUFMANN(), monto: null })).toEqual({
      tipo: "sin-monto",
    });
    const exceso = { ...KAUFMANN(), monto: 2_500_000 };
    expect(parcialidad(exceso, CAND_KAUFMANN())).toEqual({ tipo: "exceso", monto: 120000 });
  });
});

describe("carta de clasificar — sugerencia sólo si hay regla", () => {
  const cuentasPorCodigo = new Map<string, OpcionCuentaV07>([
    ["5.2.03", { id: CUENTA_SOFTWARE, nombre: "Software y tecnología", seleccionable: true }],
  ]);

  it("con regla: resuelve la cuenta por CÓDIGO contra el catálogo", () => {
    expect(sugerenciaCategoria(categoriaSugeridaDattatec(), cuentasPorCodigo)).toEqual({
      cuentaId: CUENTA_SOFTWARE,
      categoriaCanonica: "operational_expense",
      nombre: "Software y tecnología",
      confianza: 0.92,
      reglaId: "regla-dattatec",
    });
  });

  it("sin regla: null — el backend no inventa y el modelo tampoco", () => {
    expect(sugerenciaCategoria(categoriaSinSugerencia(), cuentasPorCodigo)).toBeNull();
    expect(sugerenciaCategoria(null, cuentasPorCodigo)).toBeNull();
  });

  it("la cuenta sugerida no está en el catálogo activo → se muestra pero sin id para guardar", () => {
    const sug = sugerenciaCategoria(categoriaSugeridaDattatec(), new Map());
    expect(sug?.nombre).toBe("Software y tecnología");
    expect(sug?.cuentaId).toBeNull();
  });
});

describe("los 3 frecuentes — historial, no sugerencia", () => {
  const cuentasPorId = new Map<string, OpcionCuentaV07>([
    [CUENTA_ARRIENDO, { id: CUENTA_ARRIENDO, nombre: "Arriendo de oficina", seleccionable: true }],
    [CUENTA_HONORARIOS, { id: CUENTA_HONORARIOS, nombre: "Honorarios", seleccionable: true }],
    [
      CUENTA_SOFTWARE,
      { id: CUENTA_SOFTWARE, nombre: "Software y tecnología", seleccionable: true },
    ],
    [
      CUENTA_REMUNERACIONES,
      { id: CUENTA_REMUNERACIONES, nombre: "Remuneraciones", seleccionable: true },
    ],
  ]);
  const items = () => itemsClasificar(sinClasificar());

  it("$381.375: la banda ×3 deja fuera los sueldos de $8.000.000", () => {
    const item = items().find((i) => i.id === MOV_TERCEROS)!;
    const f = frecuentes(clasificados(), item, cuentasPorId);
    expect(f.criterio).toBe("monto-y-direccion");
    expect(f.items).toEqual([
      { cuentaId: CUENTA_ARRIENDO, nombre: "Arriendo de oficina", veces: 4 },
      { cuentaId: CUENTA_HONORARIOS, nombre: "Honorarios", veces: 3 },
      { cuentaId: CUENTA_SOFTWARE, nombre: "Software y tecnología", veces: 2 },
    ]);
  });

  it("$89.250: nada cae en la banda ⇒ cae a 'misma dirección' Y LO DICE", () => {
    const item = items().find((i) => i.id === MOV_DATTATEC)!;
    const f = frecuentes(clasificados(), item, cuentasPorId);
    // El criterio cambia: el rótulo de la vista tiene que poder cambiar con él.
    expect(f.criterio).toBe("direccion");
    expect(f.items.map((x) => x.nombre)).toEqual([
      "Remuneraciones",
      "Arriendo de oficina",
      "Honorarios",
    ]);
  });

  it("sin historial: 'ninguno' — cero atajos inventados", () => {
    const item = items()[0]!;
    expect(frecuentes([], item, cuentasPorId)).toEqual({ items: [], criterio: "ninguno" });
  });

  it("una cuenta que el catálogo no conoce se OMITE (nunca se muestra un id crudo)", () => {
    const item = items().find((i) => i.id === MOV_TERCEROS)!;
    const f = frecuentes(clasificados(), item, new Map());
    expect(f.items).toEqual([]);
    expect(f.criterio).toBe("ninguno");
  });
});

describe("LEY 6 — el 'qué falta' del botón que nunca se deshabilita", () => {
  it("exige tipo canónico y cuenta de gestión; las notas siguen opcionales", () => {
    expect(faltaParaGuardar({ cuentaId: null, categoriaCanonica: null, notas: "" })).toBe(
      "Elige el tipo de movimiento para completar la clasificación.",
    );
    expect(
      faltaParaGuardar({ cuentaId: null, categoriaCanonica: "operational_expense", notas: "" }),
    ).toBe("Elige una cuenta de gestión para guardar este movimiento.");
    expect(
      faltaParaGuardar({
        cuentaId: CUENTA_SOFTWARE,
        categoriaCanonica: "operational_expense",
        notas: "",
      }),
    ).toBeNull();
  });
});

describe("lotes (group-by) y cola", () => {
  const items = () => itemsClasificar(sinClasificar());

  it("tres movimientos del mismo RUT ⇒ lote de 'hay 2 más'; uno solo ⇒ null", () => {
    const cola = items();
    const entel = cola.find((i) => i.id === MOV_ENTEL_1)!;
    const l = lote(cola, entel);
    expect(l).toEqual({
      clave: "rut:925800007",
      etiqueta: "925800007",
      porRut: true,
      porCuenta: false,
      otros: 2,
      ids: ["mov-entel-1", "mov-entel-2", "mov-entel-3"],
    });
    // Gemelo: el de Dattatec está solo, así que NO hay lote (no se fuerza uno).
    expect(
      lote(
        cola,
        cola.find((i) => i.id === MOV_DATTATEC)!,
      ),
    ).toBeNull();
    expect(lote(cola, null)).toBeNull();
  });

  it("sin RUT, la clave es la glosa normalizada — y se declara que es heurística", () => {
    const terceros = items().find((i) => i.id === MOV_TERCEROS)!;
    expect(claveContraparte(terceros)).toBe("glosa:transf a terceros via internet");
    const tres: ItemClasificarV07[] = [1, 2, 3].map((n) => ({ ...terceros, id: `t-${n}` }));
    expect(lote(tres, tres[0]!)?.porRut).toBe(false);
    expect(lote(tres, tres[0]!)?.otros).toBe(2);
  });

  it("agrupar al frente deja el actual primero y los del lote detrás, sin perder a nadie", () => {
    const cola = items();
    const l = lote(cola, cola[2]!)!;
    expect(agruparAlFrente(cola, 2, l.ids).map((i) => i.id)).toEqual([
      "mov-entel-1",
      "mov-entel-2",
      "mov-entel-3",
      MOV_DATTATEC,
      MOV_TERCEROS,
    ]);
  });

  it("auto-avance: resolver NO salta un ítem — el resuelto sale y el índice se queda", () => {
    /* Con 3 en la cola y el índice en 0: al resolver quedan 2 y el índice sigue en 0, que ahora
       apunta al SEGUNDO de la cola original. Sumar 1 acá se saltaría uno sin resolverlo. */
    expect(trasResolver(0, 2)).toBe(0);
    // Resolver el último: el índice retrocede al nuevo final, no se queda fuera de rango.
    expect(trasResolver(2, 2)).toBe(1);
    expect(trasResolver(0, 0)).toBe(0);
  });

  it("saltar SÍ avanza, y da la vuelta al final (el ítem se queda en la cola)", () => {
    expect(trasSaltar(0, 3)).toBe(1);
    expect(trasSaltar(2, 3)).toBe(0);
    expect(trasSaltar(0, 0)).toBe(0);
  });
});

describe("cabecera y progreso", () => {
  it("el denominador del progreso NO se mueve al resolver", () => {
    expect(progreso(0, 8)).toEqual({ resueltos: 0, total: 8, pct: 0 });
    expect(progreso(3, 5)).toEqual({ resueltos: 3, total: 8, pct: 38 });
    expect(progreso(8, 0)).toEqual({ resueltos: 8, total: 8, pct: 100 });
    expect(progreso(0, 0)).toEqual({ resueltos: 0, total: 0, pct: 0 });
  });

  it("la plata resuelta suma magnitudes DENTRO de cada moneda", () => {
    expect(
      montosResueltos([
        { monto: 2380000, moneda: "CLP" },
        { monto: 89250, moneda: "CLP" },
      ]),
    ).toEqual([{ monto: 2469250, moneda: "CLP" }]);
    expect(montosResueltos([])).toEqual([]);
  });

  /* B04 — el total de la sesión era UN `number` con el signo peso encima. Sumar pesos con
     dólares en una cifra y rotularla "$" es la misma mentira que el monto del movimiento. */
  it("NO suma monedas distintas en una cifra: una por moneda, CLP primero", () => {
    expect(
      montosResueltos([
        { monto: 5862.3, moneda: "USD" },
        { monto: 2380000, moneda: "CLP" },
        { monto: 5344, moneda: "USD" },
      ]),
    ).toEqual([
      { monto: 2380000, moneda: "CLP" },
      { monto: 11206.3, moneda: "USD" },
    ]);
  });

  it("la moneda no informada va al final y no se funde con CLP", () => {
    expect(
      montosResueltos([
        { monto: 100, moneda: null },
        { monto: 200, moneda: "CLP" },
      ]),
    ).toEqual([
      { monto: 200, moneda: "CLP" },
      { monto: 100, moneda: null },
    ]);
  });

  it("textoResuelto enumera una cifra por moneda, cada una con SU símbolo", () => {
    expect(textoResuelto([{ monto: 2380000, moneda: "CLP" }])).toBe("$2.380.000");
    const mixto = textoResuelto([
      { monto: 2380000, moneda: "CLP" },
      { monto: 5862.3, moneda: "USD" },
    ]);
    expect(mixto).toContain("$2.380.000");
    expect(mixto.replace(/ /g, "")).toContain("US$5.862,30");
    expect(mixto).toContain(" y ");
    // Sesión sin nada resuelto: el cero es un cero real, no una ausencia.
    expect(textoResuelto([])).toBe("$0");
  });

  it("monedaDeContrato conserva la AUSENCIA: nunca completa con CLP", () => {
    expect(monedaDeContrato("usd")).toBe("USD");
    expect(monedaDeContrato(" CLP ")).toBe("CLP");
    expect(monedaDeContrato(null)).toBeNull();
    expect(monedaDeContrato(undefined)).toBeNull();
    expect(monedaDeContrato("   ")).toBeNull();
  });
});

/* Ley 5 en clasificar — verificado contra `api/app/core/reversible_actions.py`
 * (qavante-api#257): el PATCH manual de "Guardar" no registra nada; lo que se lista y se
 * deshace acá es lo que corrieron `apply-rules` / `classify-reconciled` por su cuenta. */
describe("bitácora de auto-clasificación (Ley 5)", () => {
  function accion(over: Partial<ReversibleActionsListResponse["items"][number]> = {}) {
    return {
      action_id: "accion-1",
      action_type: "bank_movement.auto_classify",
      summary: "Clasificamos un movimiento con la regla 'Software recurrente'",
      created_at: "2026-08-30T12:00:00Z",
      undo_expires_at: "2026-09-06T12:00:00Z",
      undo_available: true,
      undo_result: null,
      status: "active",
      reverted_at: null,
      reverted_by: null,
      ...over,
    };
  }

  it("trae SÓLO auto_classify con undo_available true, mapeado a lo que la carta necesita", () => {
    const resp: ReversibleActionsListResponse = {
      total: 3,
      items: [
        accion({ action_id: "a1" }),
        // Otro action_type (marcado de cesión): no es de esta carta.
        accion({ action_id: "a2", action_type: "receivable.mark_ceded" }),
        // Mismo action_type pero YA derivado: el filtro `only_undoable` del query no lo
        // garantiza — `undo_available` es el que manda, ítem por ítem.
        accion({ action_id: "a3", undo_available: false, undo_result: "undo_not_supported" }),
      ],
    };
    expect(accionesAutoClasificar(resp)).toEqual([
      {
        actionId: "a1",
        resumen: "Clasificamos un movimiento con la regla 'Software recurrente'",
        creadaEn: "2026-08-30T12:00:00Z",
        vencePlazo: "2026-09-06T12:00:00Z",
      },
    ]);
  });

  it("sin respuesta o sin items: lista vacía, no un throw", () => {
    expect(accionesAutoClasificar(null)).toEqual([]);
    expect(accionesAutoClasificar(undefined)).toEqual([]);
    expect(accionesAutoClasificar({ total: 0, items: [] })).toEqual([]);
  });

  function revert(over: Partial<RevertActionResponse> = {}): RevertActionResponse {
    return {
      action_id: "accion-1",
      action_type: "bank_movement.auto_classify",
      result: "reverted",
      reverted_at: "2026-08-30T12:05:00Z",
      detail: {},
      ...over,
    };
  }

  it("reverted / already_reverted / undo_expired: los tres resultados simples", () => {
    expect(interpretarDeshacer(revert({ result: "reverted" }))).toEqual({ tipo: "deshecho" });
    expect(interpretarDeshacer(revert({ result: "already_reverted" }))).toEqual({
      tipo: "ya-deshecho",
    });
    expect(interpretarDeshacer(revert({ result: "undo_expired" }))).toEqual({ tipo: "vencido" });
  });

  it("LA COMPUERTA: estado_derivado y estado_bloqueado son DOS `tipo` distintos con copy local cerrado", () => {
    const derivado = interpretarDeshacer(
      revert({
        result: "undo_not_supported",
        detail: {
          motivo: "estado_derivado",
          explicacion: "Algo cambió después de esta acción: no se tocó nada.",
        },
      }),
    );
    const bloqueado = interpretarDeshacer(
      revert({
        result: "undo_not_supported",
        detail: {
          motivo: "estado_bloqueado",
          explicacion: "Otra operación está modificando esto mismo. No se tocó nada.",
        },
      }),
    );
    expect(derivado).toEqual({
      tipo: "protegido",
      explicacion:
        "Algo cambió después de esta clasificación automática (probablemente la reclasificaste tú). Ese cambio sigue en pie: no se tocó nada.",
    });
    expect(bloqueado).toEqual({
      tipo: "bloqueado",
      explicacion:
        "Otra operación está usando este movimiento justo ahora. No se tocó nada; puedes reintentar en unos segundos.",
    });
    // El positivo gemelo del assert que de verdad importa: si algún día alguien colapsa las
    // dos ramas en un solo `tipo`, este `expect` es el que se rompe.
    expect(derivado.tipo).not.toBe(bloqueado.tipo);
  });

  it("ignora explicacion libre del payload 200 aun con un motivo reconocido", () => {
    const secreto = "Bearer secret-token SELECT * FROM users /api/internal";
    const resultado = interpretarDeshacer(
      revert({
        result: "undo_not_supported",
        detail: { motivo: "estado_derivado", explicacion: secreto },
      }),
    );
    expect(resultado).toMatchObject({ tipo: "protegido" });
    if (resultado.tipo === "protegido") expect(resultado.explicacion).not.toContain(secreto);
  });

  it("protegido NO es lo mismo que bloqueado tampoco a la inversa (gemelo positivo del anterior)", () => {
    expect("protegido").not.toBe("bloqueado");
    expect(
      interpretarDeshacer(
        revert({ result: "undo_not_supported", detail: { motivo: "estado_bloqueado" } }),
      ).tipo,
    ).toBe("bloqueado");
    expect(
      interpretarDeshacer(
        revert({ result: "undo_not_supported", detail: { motivo: "estado_derivado" } }),
      ).tipo,
    ).toBe("protegido");
  });

  it("sin `detail.explicacion` del backend, cada motivo tiene su propio texto por defecto (no el genérico del otro)", () => {
    const derivado = interpretarDeshacer(
      revert({ result: "undo_not_supported", detail: { motivo: "estado_derivado" } }),
    );
    const bloqueado = interpretarDeshacer(
      revert({ result: "undo_not_supported", detail: { motivo: "estado_bloqueado" } }),
    );
    expect(derivado.tipo).toBe("protegido");
    expect(bloqueado.tipo).toBe("bloqueado");
    if (derivado.tipo === "protegido" && bloqueado.tipo === "bloqueado") {
      expect(derivado.explicacion).not.toBe(bloqueado.explicacion);
      expect(derivado.explicacion.length).toBeGreaterThan(0);
      expect(bloqueado.explicacion.length).toBeGreaterThan(0);
    }
  });

  it("undo_not_supported sin motivo reconocido: 'no sé' explícito, no se inventa un motivo", () => {
    expect(interpretarDeshacer(revert({ result: "undo_not_supported", detail: {} }))).toEqual({
      tipo: "no-reconocido",
    });
    expect(
      interpretarDeshacer(
        revert({ result: "undo_not_supported", detail: { motivo: "otra-cosa" } }),
      ),
    ).toEqual({ tipo: "no-reconocido" });
    expect(interpretarDeshacer(revert({ result: "undo_not_supported" }))).toEqual({
      tipo: "no-reconocido",
    });
  });

  it("un `result` que no está en la lista cerrada tampoco se afirma como éxito", () => {
    expect(interpretarDeshacer(revert({ result: "algo_no_documentado" }))).toEqual({
      tipo: "no-reconocido",
    });
  });
});
