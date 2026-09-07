import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn, waitFor } from "storybook/test";
import { BandejaV07View } from "./bandeja-v07-view";
import {
  candidatos as adaptarCandidatos,
  itemsClasificar,
  itemsConciliar,
  type AccionAutoClasificarV07,
} from "./bandeja-v07-model";
import type { RevertActionResponse } from "@/lib/api/reversible-actions";
import {
  HOY,
  CUENTA_ARRIENDO,
  CUENTA_SOFTWARE,
  CUENTA_TELECOM,
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

/* V07 · Bandeja de excepciones, en sus estados y con sus interacciones.
 *
 * Corren en Chromium headless como gate (`npm run test:storybook`). Acá vive lo que el HTML
 * estático no puede probar y que es justo lo que la spec exige:
 *
 *   · Enter resuelve el caso CON sugerencia — y NO hace nada sin ella (Ley 3).
 *   · El auto-avance pasa al SIGUIENTE, sin saltarse ninguno.
 *   · El toast del "Sí, conciliar"/"Guardar" que el DUEÑO acaba de apretar ofrece Deshacer sólo
 *     en conciliar (existe de antes); en clasificar NO, y es correcto — ver el gemelo positivo en
 *     la misma tanda, con la misma query, para que el negativo no pase por estar mal escrito.
 *   · La bitácora de lo que Qavante clasificó SOLO (issue #90, ADR-0113) SÍ tiene Deshacer en la
 *     carta de clasificar, y distingue sus dos motivos de negativa (`estado_derivado` no
 *     reintentable, `estado_bloqueado` sí) con el MISMO botón "Reintentar" — presente en uno,
 *     ausente en el otro.
 *   · Guardar no está deshabilitado nunca: al pulsarlo sin categoría marca en rojo qué falta
 *     (Ley 6) y NO guarda. */

const CONCILIAR = itemsConciliar(colaConciliar());
const CLASIFICAR = itemsClasificar(sinClasificar());
const GLOSA_JANA =
  "Transf. a terceros vía Internet a cuenta 32667051 B.BCI, IGNACIO MATIAS JANA, Rut 18.974.184-7, el 04-09-2026";

function clasificarJana() {
  const items = itemsClasificar(sinClasificar([MOV_TERCEROS, MOV_DATTATEC]));
  return [
    {
      ...items[0]!,
      glosa: GLOSA_JANA,
      cuentaDestino: "32667051",
      rutGlosa: "189741847",
    },
    ...items.slice(1),
  ];
}

/** Ley 2 — los elementos con token rojo que hay en pantalla. */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

/** El toast vive FUERA del canvas de la story (viewport `fixed` montado por el provider). */
function toasts(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[aria-label="Notificaciones"] [role="status"]'),
  );
}

const meta = {
  title: "Rediseño F2 / V07 Bandeja",
  component: BandejaV07View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V07 · Bandeja de excepciones (ESPECIFICACION §V07): header con N pendientes, tabs Conciliar/Clasificar con conteo, barra de progreso y UNA card a la vez con auto-avance. La carta de conciliar muestra evidencia a dos lados y sólo los chips cuyas verificaciones pasaron (Ley 3); su toast lleva Deshacer porque la reversión existe. La carta de clasificar entrega UNA decisión, con sugerencia sólo si una regla matchea; el toast de ESE 'Guardar' nunca lleva Deshacer (lo decidió el dueño, no Qavante solo · verificado contra el backend, no es un hueco). Lo que Qavante clasificó SOLO por regla o por conciliación sí tiene Deshacer, en un banner arriba de la carta (issue #90, `qavante-api#257`/ADR-0113): distingue si el Deshacer se negó porque el dueño reclasificó a mano después (no reintentable) o porque otra operación tiene la fila tomada ahora mismo (sí reintentable).",
      },
    },
  },
  args: {
    conciliar: CONCILIAR,
    clasificar: CLASIFICAR,
    cuentas: cuentas(),
    categoriasCanonicas: categoriasCanonicas(),
    clasificados: clasificados(),
    onConciliar: fn(async () => undefined),
    onNoEsEsta: fn(async () => undefined),
    onClasificar: fn(async () => undefined),
    issueSucesor: "#90",
    hoy: HOY,
  },
} satisfies Meta<typeof BandejaV07View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConciliarConSugerencia: Story = {
  name: "Conciliar · con sugerencia · Enter resuelve, avanza y el toast trae Deshacer",
  args: {
    candidatos: {
      movimientoId: MOV_KAUFMANN,
      lista: adaptarCandidatos(candidatosKaufmann()),
      cargando: false,
    },
    onConciliar: fn(),
    onDeshacerConciliar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("7 pendientes")).toBeInTheDocument();

    // Ley 3 — los cinco chips son verificaciones que pasaron de verdad.
    await expect(canvas.getByText("RUT en la glosa")).toBeInTheDocument();
    await expect(canvas.getByText("folio 435 en la glosa")).toBeInTheDocument();
    await expect(canvas.getByText("monto exacto")).toBeInTheDocument();
    await expect(canvas.getByText("a 21 días del documento")).toBeInTheDocument();
    // Ley 2 — ningún rojo en esta card.
    await expect(rojos(canvasElement)).toHaveLength(0);

    await userEvent.keyboard("{Enter}");
    await expect(args.onConciliar).toHaveBeenCalledTimes(1);

    // El toast, top-right, CON Deshacer (la reversión de conciliar existe).
    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    const deshacer = within(toasts()[0]!).getByRole("button", { name: "Deshacer" });
    await expect(deshacer).toBeInTheDocument();
    await expect(toasts()[0]!).toHaveTextContent("Comercial Kaufmann S.A.");
    await expect(toasts()[0]!).toHaveTextContent("$2.380.000");

    // AUTO-AVANCE: pasa al SIGUIENTE de la cola (el abono de Mirko González), no se salta ninguno.
    await waitFor(
      async () => await expect(canvas.getByText(/Conciliar 1 de 1/)).toBeInTheDocument(),
    );
    await expect(canvas.getByText(/ABONO TRANSFERENCIA MIRKO GONZALEZ/)).toBeInTheDocument();
    // Y el progreso lo cuenta.
    await expect(canvas.getByText(/resueltos en esta sesión/)).toHaveTextContent(
      "1 de 7 resueltos en esta sesión",
    );
    /* LA MUTACIÓN QUE ESTO MATA: el header que usa el total de la SESIÓN (7) en vez de los
       pendientes VIVOS (6) después de resolver uno — mentiría "7 pendientes" con 6 en la cola. */
    await expect(canvas.getByText("6 pendientes")).toBeInTheDocument();

    await userEvent.click(deshacer);
    await expect(args.onDeshacerConciliar).toHaveBeenCalledTimes(1);
  },
};

export const ConciliarEvitaDobleEnvio: Story = {
  name: "Conciliar · doble activación · envía una sola escritura",
  args: {
    candidatos: {
      movimientoId: MOV_KAUFMANN,
      lista: adaptarCandidatos(candidatosKaufmann()),
      cargando: false,
    },
    onConciliar: fn(
      async () => await new Promise<void>((resolve) => window.setTimeout(resolve, 30)),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole("button", { name: /Sí, conciliar/ });
    boton.click();
    boton.click();
    await expect(args.onConciliar).toHaveBeenCalledTimes(1);
    await expect(boton).toBeDisabled();
    const saltar = canvas.getByRole("button", { name: /^Saltar/ });
    await expect(saltar).toBeDisabled();
    saltar.click();
    await expect(canvas.getByLabelText("Excepción por conciliar")).toHaveTextContent(
      "Comercial Kaufmann",
    );
  },
};

export const ConciliarSinEvidencia: Story = {
  name: "Conciliar · sin evidencia suficiente · Enter NO resuelve (Ley 3)",
  args: {
    conciliar: CONCILIAR.filter((i) => i.id === MOV_VOLCAN),
    candidatos: {
      movimientoId: MOV_VOLCAN,
      lista: adaptarCandidatos(candidatosVolcan()),
      cargando: false,
    },
    onConciliar: fn(),
    onNoEsEsta: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/ninguna verificación pasó entre estos dos lados/),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Sí, conciliar/ })).toBeNull();
    await expect(canvas.getByRole("button", { name: /Buscar el documento/ })).toBeInTheDocument();

    /* LA MUTACIÓN QUE ESTO MATA: si Enter resolviera igual, acá se llamaría a onConciliar. */
    await userEvent.keyboard("{Enter}");
    await expect(args.onConciliar).not.toHaveBeenCalled();
    await expect(toasts()).toHaveLength(0);
    // Sigue en la misma card: no avanzó ni resolvió nada.
    await expect(canvas.getByText(/Conciliar 1 de 1/)).toBeInTheDocument();

    // "Buscar otro documento" sí ofrece el candidato para una elección humana explícita.
    await userEvent.click(canvas.getByRole("button", { name: /Buscar el documento/ }));
    await expect(canvas.getByText("Elegir otro documento")).toBeInTheDocument();
    await expect(
      canvas.getByRole("radio", { name: /Cia. Industrial El Volcan S.A./ }),
    ).toBeInTheDocument();
  },
};

export const ConciliarNoEsEsta: Story = {
  name: "Conciliar · No es esta (botón) · descarta la sugerencia y avisa al padre",
  args: {
    conciliar: CONCILIAR.filter((i) => i.id === MOV_KAUFMANN || i.id === MOV_VOLCAN),
    candidatos: {
      movimientoId: MOV_KAUFMANN,
      lista: adaptarCandidatos(candidatosKaufmann()),
      cargando: false,
    },
    onNoEsEsta: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Conciliar 1 de 2/)).toBeInTheDocument();

    /* LA MUTACIÓN QUE ESTO MATA: si se borra la llamada a `onNoEsEsta`, el clic en "No es esta"
       queda sin efecto sobre el padre y esta aserción no se cumple. */
    await userEvent.click(canvas.getByRole("button", { name: /No es esta/ }));
    await expect(args.onNoEsEsta).toHaveBeenCalledTimes(1);
    await expect(args.onNoEsEsta).toHaveBeenCalledWith(
      expect.objectContaining({ id: MOV_KAUFMANN }),
      expect.objectContaining({ nombre: "Comercial Kaufmann S.A." }),
    );
    // El toast avisa del descarte, sin Deshacer (no hay reversión de un "no es esta").
    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    await expect(toasts()[0]!).toHaveTextContent("Descartada la sugerencia");
    await expect(within(toasts()[0]!).queryByRole("button", { name: "Deshacer" })).toBeNull();

    // AUTO-AVANCE: pasa al siguiente ítem de la cola, no se queda pegado.
    await waitFor(
      async () => await expect(canvas.getByText(/Conciliar 1 de 1/)).toBeInTheDocument(),
    );
    await expect(canvas.getByText(/ABONO TRANSFERENCIA MIRKO GONZALEZ/)).toBeInTheDocument();
  },
};

export const ConciliarNoEsEstaTecla: Story = {
  name: "Conciliar · No es esta (tecla N) · el atajo dispara la misma función",
  args: {
    conciliar: CONCILIAR.filter((i) => i.id === MOV_KAUFMANN),
    candidatos: {
      movimientoId: MOV_KAUFMANN,
      lista: adaptarCandidatos(candidatosKaufmann()),
      cargando: false,
    },
    onNoEsEsta: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Conciliar 1 de 1/)).toBeInTheDocument();

    /* LA MUTACIÓN QUE ESTO MATA: si se borra la llamada a `onNoEsEsta` en el manejo de teclas,
       la tecla `N` queda muda y esta aserción no se cumple. */
    await userEvent.keyboard("n");
    await expect(args.onNoEsEsta).toHaveBeenCalledTimes(1);
    await expect(args.onNoEsEsta).toHaveBeenCalledWith(
      expect.objectContaining({ id: MOV_KAUFMANN }),
      expect.objectContaining({ nombre: "Comercial Kaufmann S.A." }),
    );
  },
};

export const ClasificarConRegla: Story = {
  name: "Clasificar · con regla · Enter guarda y el toast NO trae Deshacer",
  args: {
    tabInicial: "clasificar",
    sugerencia: { movimientoId: MOV_DATTATEC, valor: sugerenciaSoftware(), cargando: false },
    onClasificar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/una regla tuya con confianza 92%/)).toBeInTheDocument();
    // La sugerencia PRE-SELECCIONA; nunca guarda sola.
    const select = canvas.getByLabelText("Cuenta de gestión") as HTMLSelectElement;
    await waitFor(async () => await expect(select.value).toBe(CUENTA_SOFTWARE));
    await expect(canvas.getByLabelText("Tipo de movimiento")).toHaveValue("operational_expense");
    await expect(args.onClasificar).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    await expect(args.onClasificar).toHaveBeenCalledWith(
      expect.objectContaining({ id: MOV_DATTATEC }),
      CUENTA_SOFTWARE,
      "operational_expense",
      "",
    );

    /* LA MUTACIÓN QUE ESTO MATA: ofrecer Deshacer donde no hay reversión. El gemelo POSITIVO de
       este negativo está en `ConciliarConSugerencia`, con la misma query. */
    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    await expect(toasts()[0]!).toHaveTextContent("Software y tecnología");
    await expect(within(toasts()[0]!).queryByRole("button", { name: "Deshacer" })).toBeNull();

    // Guardó desde la sugerencia ⇒ no se ofrece crear una regla que ya existe.
    await expect(canvas.queryByText(/¿Siempre/)).toBeNull();

    /* AUTO-AVANCE sobre una cola de 5: el siguiente es el SEGUNDO de la cola, no el tercero.
       Con dos ítems las dos ramas coinciden y la mutación "avanzar de más" pasaría inadvertida;
       con cinco, no. */
    await waitFor(
      async () =>
        await expect(canvas.getByLabelText("Excepción por clasificar")).toHaveTextContent(
          "Clasificar 1 de 4",
        ),
    );
    await expect(canvas.getByLabelText("Excepción por clasificar")).toHaveTextContent(
      "TRANSF. A TERCEROS VIA INTERNET",
    );
  },
};

export const ClasificarFallaPersistencia: Story = {
  name: "Clasificar · la API falla · conserva el movimiento y no afirma éxito",
  args: {
    tabInicial: "clasificar",
    sugerencia: { movimientoId: MOV_DATTATEC, valor: sugerenciaSoftware(), cargando: false },
    onClasificar: fn(async () => {
      throw new Error("falló la escritura");
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByLabelText("Excepción por clasificar");
    await waitFor(
      async () =>
        await expect(canvas.getByLabelText("Cuenta de gestión")).toHaveValue(CUENTA_SOFTWARE),
    );

    await userEvent.click(canvas.getByRole("button", { name: /Guardar/ }));
    await expect(args.onClasificar).toHaveBeenCalledTimes(1);
    await expect(card).toHaveTextContent("Clasificar 1 de 5");
    await expect(card).toHaveTextContent("DATTATEC");
    await expect(toasts()).toHaveLength(0);
  },
};

export const ClasificarSinSugerencia: Story = {
  name: "Clasificar · sin sugerencia · Guardar responde en vez de estar deshabilitado (Ley 6)",
  args: {
    tabInicial: "clasificar",
    clasificar: clasificarJana(),
    sugerencia: { movimientoId: MOV_TERCEROS, valor: null, cargando: false },
    onClasificar: fn(),
    onCrearRegla: fn(
      async () => await new Promise<void>((resolve) => window.setTimeout(resolve, 30)),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/sin regla que calce: sin evidencia no se sugiere/),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/RUT en la glosa: 18\.974\.184-7/)).toBeInTheDocument();
    await expect(canvas.queryByText(/3\.266\.705-1/)).toBeNull();
    await expect(
      canvas.getByRole("button", { name: /Arriendo de oficina · 4/ }),
    ).toBeInTheDocument();

    /* LA MUTACIÓN QUE ESTO MATA: deshabilitar Guardar sin categoría. */
    const guardar = canvas.getByRole("button", { name: /Guardar/ });
    await expect(guardar).not.toBeDisabled();
    await expect(rojos(canvasElement)).toHaveLength(0);

    await userEvent.click(guardar);
    await expect(args.onClasificar).not.toHaveBeenCalled();
    // Ley 6 + Ley 2: aparece UN rojo, y es el "qué falta".
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent(
      "Elige el tipo de movimiento para completar la clasificación.",
    );

    // Elegir un frecuente y guardar: ≤ 2 clics + categoría.
    await userEvent.click(canvas.getByRole("button", { name: /Arriendo de oficina · 4/ }));
    await expect(rojos(canvasElement)).toHaveLength(0);
    await userEvent.selectOptions(
      canvas.getByLabelText("Tipo de movimiento"),
      "operational_expense",
    );
    await userEvent.click(canvas.getByRole("button", { name: /Guardar/ }));
    await expect(args.onClasificar).toHaveBeenCalledWith(
      expect.objectContaining({ id: MOV_TERCEROS }),
      CUENTA_ARRIENDO,
      "operational_expense",
      "",
    );

    // Clasificado a mano ⇒ la oferta de regla, en una línea.
    await expect(canvas.getByText(/¿Siempre/)).toBeInTheDocument();
    await expect(canvas.getByText(/cuenta destino 32667051/)).toBeInTheDocument();
    const crearRegla = canvas.getByRole("button", { name: "Crear regla" });
    crearRegla.click();
    crearRegla.click();
    await expect(args.onCrearRegla).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("button", { name: "Creando…" })).toBeDisabled();
    await expect(canvas.getByText(/¿Siempre/)).toBeInTheDocument();
    await waitFor(async () => await expect(canvas.queryByText(/¿Siempre/)).toBeNull());
    await waitFor(
      async () =>
        await expect(document.body).toHaveTextContent(
          "Regla creada: la próxima vez se clasifica sola.",
        ),
    );
  },
};

export const CrearReglaFallaPersistencia: Story = {
  name: "Clasificar · crear regla falla · conserva la oferta y no afirma éxito",
  args: {
    tabInicial: "clasificar",
    clasificar: itemsClasificar(sinClasificar([MOV_TERCEROS, MOV_DATTATEC])),
    sugerencia: { movimientoId: MOV_TERCEROS, valor: null, cargando: false },
    onClasificar: fn(async () => undefined),
    onCrearRegla: fn(async () => {
      throw new Error("falló la regla");
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Arriendo de oficina · 4/ }));
    await userEvent.selectOptions(
      canvas.getByLabelText("Tipo de movimiento"),
      "operational_expense",
    );
    await userEvent.click(canvas.getByRole("button", { name: /Guardar/ }));
    await expect(canvas.getByText(/¿Siempre/)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Crear regla" }));
    await expect(args.onCrearRegla).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText(/¿Siempre/)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Crear regla" })).not.toBeDisabled();
    await expect(document.body).not.toHaveTextContent(
      "Regla creada: la próxima vez se clasifica sola.",
    );
  },
};

/** Fixture de la bitácora Ley 5 — una auto-clasificación deshacible. `actionId` es lo único que
 *  `onDeshacerAutoClasificar` recibe (UUID de `audit.reversible_actions`, no un `movement_id`). */
const ACCION_AUTO: AccionAutoClasificarV07 = {
  actionId: "accion-90-1",
  resumen: "Clasificamos un movimiento con la regla 'Software recurrente'",
  creadaEn: "2026-08-30T09:00:00Z",
  vencePlazo: "2026-09-06T09:00:00Z",
};

export const ClasificarAutoDeshecho: Story = {
  name: "Clasificar · bitácora auto · Deshacer con éxito vuelve el movimiento a sin clasificar",
  args: {
    tabInicial: "clasificar",
    autoClasificadas: [ACCION_AUTO],
    onDeshacerAutoClasificar: fn(async (): Promise<RevertActionResponse> => ({
      action_id: ACCION_AUTO.actionId,
      action_type: "bank_movement.auto_classify",
      result: "reverted",
      reverted_at: "2026-08-30T12:00:00Z",
      detail: { movement_id: "mov-x", movimientos_restaurados: 1 },
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    /* `/Qavante clasificó/` a secas también matchea el disclaimer de HuecosDeclarados ("Lo que
     * Qavante clasificó por su cuenta sí tiene Deshacer..."), que vive siempre en esta misma
     * carta — dos elementos, `getMultipleElementsFoundError`. "solo," (con la coma) sólo
     * aparece en el propio banner: el resto de las apariciones de "solo" en este archivo
     * terminan en '.', ':', '—' o 'y', nunca en coma. No tocar el copy de HuecosDeclarados: es
     * un hueco distinto, ya revisado. */
    await expect(canvas.getByText(/Qavante clasificó solo,/)).toBeInTheDocument();
    await expect(
      canvas.getByText("Clasificamos un movimiento con la regla 'Software recurrente'"),
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Deshacer" }));
    await expect(args.onDeshacerAutoClasificar).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: ACCION_AUTO.actionId }),
    );

    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    await expect(toasts()[0]!).toHaveTextContent("Deshecho");
    await expect(toasts()[0]!).toHaveTextContent("sin clasificar");
  },
};

export const ClasificarAutoProtegido: Story = {
  name: "Clasificar · bitácora auto · negado por trabajo manual del dueño (estado_derivado): NO se ofrece reintentar",
  args: {
    tabInicial: "clasificar",
    autoClasificadas: [ACCION_AUTO],
    onDeshacerAutoClasificar: fn(async (): Promise<RevertActionResponse> => ({
      action_id: ACCION_AUTO.actionId,
      action_type: "bank_movement.auto_classify",
      result: "undo_not_supported",
      reverted_at: null,
      detail: {
        motivo: "estado_derivado",
        explicacion: "Algo cambió después de esta acción: no se tocó nada.",
      },
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Deshacer" }));
    await expect(args.onDeshacerAutoClasificar).toHaveBeenCalledTimes(1);

    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    await expect(toasts()[0]!).toHaveTextContent(
      "Algo cambió después de esta acción: no se tocó nada.",
    );
    /* LA COMPUERTA que pide el issue #90: estado_derivado NO es reintentable — no hay nada que
       arreglar reintentando, el cambio del dueño sigue vigente. Gemelo con `ClasificarAutoBloqueado`,
       MISMA query de rol/nombre, resultado opuesto. */
    await expect(within(toasts()[0]!).queryByRole("button", { name: "Reintentar" })).toBeNull();
  },
};

export const ClasificarAutoBloqueado: Story = {
  name: "Clasificar · bitácora auto · negado por bloqueo (estado_bloqueado): SÍ se ofrece reintentar",
  args: {
    tabInicial: "clasificar",
    autoClasificadas: [ACCION_AUTO],
    onDeshacerAutoClasificar: fn(async (): Promise<RevertActionResponse> => ({
      action_id: ACCION_AUTO.actionId,
      action_type: "bank_movement.auto_classify",
      result: "undo_not_supported",
      reverted_at: null,
      detail: {
        motivo: "estado_bloqueado",
        explicacion: "Otra operación está usando esto mismo. No se tocó nada; puedes reintentar.",
      },
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Deshacer" }));

    await waitFor(async () => await expect(toasts()).toHaveLength(1));
    await expect(toasts()[0]!).toHaveTextContent("Otra operación está usando esto mismo");
    /* Gemelo POSITIVO de `ClasificarAutoProtegido`, misma query: acá SÍ está. */
    const reintentar = within(toasts()[0]!).getByRole("button", { name: "Reintentar" });

    await userEvent.click(reintentar);
    await expect(args.onDeshacerAutoClasificar).toHaveBeenCalledTimes(2);
  },
};

export const ClasificarEnLote: Story = {
  name: "Clasificar · lote · 3 del mismo RUT con confirmación explícita",
  args: {
    tabInicial: "clasificar",
    clasificar: itemsClasificar(
      sinClasificar([MOV_DATTATEC, MOV_ENTEL_1, MOV_ENTEL_2, MOV_ENTEL_3]),
    ),
    sugerencia: { movimientoId: MOV_DATTATEC, valor: null, cargando: false },
    onClasificarLote: fn(
      async () => await new Promise<void>((resolve) => window.setTimeout(resolve, 30)),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // El de Dattatec está solo: sin banner de lote.
    await expect(canvas.queryByText(/esperando categoría/)).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: /^Saltar/ }));
    await expect(canvas.getByText(/Hay/)).toHaveTextContent(
      "Hay 2 más de 92.580.000-7 esperando categoría",
    );
    await expect(
      canvas.getByText(
        /Puedes clasificarlos de una sola vez después de elegir categoría y confirmar/,
      ),
    ).toBeInTheDocument();
    // Agrupar los pone seguidos en la cola, sin clasificarlos todavía.
    await userEvent.click(canvas.getByRole("button", { name: /Revisar los 3 seguidos/ }));
    /* Agrupar deja al que estabas viendo PRIMERO: la cola se reordena, el cursor no se mueve. */
    await expect(canvas.getByLabelText("Excepción por clasificar")).toHaveTextContent(
      "Clasificar 1 de 4",
    );
    await expect(canvas.getByLabelText("Excepción por clasificar")).toHaveTextContent(
      "12 ago 2026",
    );

    await userEvent.selectOptions(canvas.getByLabelText("Cuenta de gestión"), CUENTA_TELECOM);
    await userEvent.selectOptions(canvas.getByLabelText("Tipo de movimiento"), "supplier_payment");
    await userEvent.click(canvas.getByRole("button", { name: "Clasificar 3 de una vez" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Vas a clasificar 3 movimientos como Pago a proveedor · Telecomunicaciones",
    );
    const confirmar = canvas.getByRole("button", { name: "Sí, clasificar 3" });
    confirmar.click();
    confirmar.click();
    await expect(args.onClasificarLote).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("button", { name: "Clasificando…" })).toBeInTheDocument();
    await waitFor(
      async () =>
        await expect(args.onClasificarLote).toHaveBeenCalledWith(
          [MOV_ENTEL_1, MOV_ENTEL_2, MOV_ENTEL_3],
          CUENTA_TELECOM,
          "supplier_payment",
          "",
        ),
    );
  },
};

export const BandejaVacia: Story = {
  name: "Bandeja vacía · celebratorio sobrio, sin rojo y sin prometer de más",
  args: {
    conciliar: itemsConciliar(colaConciliarVacia()),
    clasificar: itemsClasificar(sinClasificarVacio()),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nada espera tu decisión")).toBeInTheDocument();
    await expect(
      canvas.getByText(/Tus informes y tu proyección ya no dejan nada de esta bandeja afuera/),
    ).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinRespuesta: Story = {
  name: "Error · las dos fuentes caídas: la pantalla está ciega, no vacía",
  args: {
    conciliar: null,
    clasificar: null,
    conciliarMotivo: "No pudimos conectar con la cola de conciliación (error de red).",
    onReintentar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/No pudimos consultar tu bandeja de excepciones/),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/error de red/)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: "Reintentar" }));
    await expect(args.onReintentar).toHaveBeenCalledTimes(1);
  },
};
