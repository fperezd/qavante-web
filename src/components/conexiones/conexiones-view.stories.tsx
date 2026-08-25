import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { SourceStatus } from "@/lib/api/sources-status";
import { ConexionesCargando, ConexionesTabla, ConexionesVacio } from "./conexiones-view";

/* Pantalla Conexiones (V11). Se testean las piezas PRESENTACIONALES: el runner de Storybook no
   levanta MSW, así que testear `ConexionesView` entero sólo mostraría su estado de error. Con las
   piezas sueltas quedan cubiertos carga, vacío y la tabla con los seis `SourceState`. */

const meta = {
  title: "Capa 3 / Conexiones / ConexionesView",
  component: ConexionesTabla,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ConexionesTabla>;

export default meta;
type Story = StoryObj<typeof meta>;

const SANA: SourceStatus = {
  source: "sii_rcv",
  display_name: "SII",
  category: "tax",
  state: "ok",
  last_sync: "2026-06-27T12:30:00Z",
  reason: null,
};

const SEIS_ESTADOS: SourceStatus[] = [
  SANA,
  {
    source: "sii_f29",
    display_name: "SII F29",
    category: "tax",
    state: "syncing",
    last_sync: "2026-06-26T09:00:00Z",
    reason: "Sincronizando…",
  },
  {
    source: "bice",
    display_name: "Banco BICE",
    category: "bank",
    state: "stale",
    last_sync: "2026-06-20T09:00:00Z",
    reason: "upstream: sii_rate_limited: 429 Too Many Requests",
  },
  {
    source: "buk",
    display_name: "Buk",
    category: "labor",
    state: "missing",
    last_sync: null,
    reason: "Fuente no conectada todavía",
  },
  {
    source: "sii_clave_empresa",
    display_name: "SII Clave Empresa",
    category: "tax",
    state: "error",
    last_sync: "2026-05-30T11:00:00Z",
    reason: "RUT inválido o con DV incorrecto.",
  },
  {
    source: "sii_f22",
    display_name: "SII F22",
    category: "tax",
    state: "unavailable",
    last_sync: null,
    reason: "F22 no implementado en Fase 1",
  },
];

/** Los seis estados juntos: cada fila muestra SU etiqueta (nada de "Al día ✓" universal) y la
 *  línea de fecha nunca afirma que dejaron de llegar documentos desde el último sync exitoso. */
export const SeisEstados: Story = {
  name: "Los seis SourceState",
  args: { sources: SEIS_ESTADOS },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Al día")).toBeVisible();
    await expect(c.getByText("Sincronizando")).toBeVisible();
    await expect(c.getByText("Datos atrasados")).toBeVisible();
    await expect(c.getByText("Sin conectar")).toBeVisible();
    await expect(c.getByText("Requiere tu acción")).toBeVisible();
    await expect(c.getByText("Aún no disponible")).toBeVisible();
    // Ninguna fila puede decir "no llegan documentos" usando la fecha del último sync EXITOSO.
    await expect(c.queryByText(/no llegan documentos/i)).toBeNull();
    // El banner separa lo que el dueño resuelve (missing + error) de lo que no (stale + stub).
    await expect(c.getByText(/2 requieren tu acción/i)).toBeVisible();
    await expect(c.getByText(/2 están con problemas que no dependen de ti/i)).toBeVisible();
  },
};

/** La columna de ACCIÓN no puede quedar amputada en móvil. A 360px las tres columnas no
 *  entran: el contenedor tiene que poder scrollear en horizontal (`overflow-x-auto`), no
 *  recortar (`overflow-hidden`). Un dato primario truncado sin salida es peor que un scroll. */
export const AccionAlcanzableEnMovil: Story = {
  name: "La acción se alcanza a 360px",
  args: { sources: SEIS_ESTADOS },
  play: async ({ canvasElement }) => {
    const tabla = canvasElement.querySelector("table");
    await expect(tabla).not.toBeNull();
    const contenedor = tabla!.parentElement!;
    await expect(getComputedStyle(contenedor).overflowX).toBe("auto");
    // Y el contenido tiene un ancho mínimo que mantiene las tres columnas legibles.
    await expect(tabla!.getBoundingClientRect().width).toBeGreaterThanOrEqual(560);
  },
};

/** `revoked → missing` conservando `last_success_at`: la fila NO puede decir que la fuente
 *  nunca se conectó al lado de un detalle técnico que dice que se revocó la credencial. */
export const CredencialRevocada: Story = {
  name: "Credencial revocada (missing con last_sync)",
  args: {
    sources: [
      {
        source: "sii_cesiones",
        display_name: "SII Cesiones",
        category: "tax",
        state: "missing",
        last_sync: "2026-08-01T10:00:00Z",
        reason: "Credencial revocada por admin.",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Desconectada")).toBeVisible();
    await expect(c.getByRole("link", { name: "Volver a conectar" })).toBeVisible();
    await expect(c.queryByText(/nunca se ha conectado/i)).toBeNull();
    await expect(c.queryByText(/aún no conectas esta fuente/i)).toBeNull();
    await expect(
      c.getByText(/estuvo conectada: lo último que llegó es del 1 .*ago/i),
    ).toBeVisible();
  },
};

/** MFA del banco: hay acción y es del dueño, pero ocurre FUERA de Qavante. La celda no puede
 *  decir "Nada que hacer" (contradiría el mensaje de al lado) ni ofrecer un enlace a
 *  credenciales (no hay ninguna clave que cambiar). Sin esta story, borrar la rama
 *  "Se resuelve fuera de Qavante." dejaba la suite entera en verde. */
export const MfaDelBanco: Story = {
  name: "MFA pendiente (acción fuera de Qavante)",
  args: {
    sources: [
      {
        source: "bice",
        display_name: "Banco BICE",
        category: "bank",
        state: "error",
        last_sync: "2026-08-20T09:00:00Z",
        reason: "upstream: mfa_required: aprueba el acceso en la app",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Se resuelve fuera de Qavante.")).toBeVisible();
    await expect(c.queryByText(/nada que hacer/i)).toBeNull();
    // Ningún enlace de acción: no hay credencial que renovar.
    await expect(c.queryByRole("link")).toBeNull();
    await expect(c.getByText(/no tienes que cambiar ninguna clave/i)).toBeVisible();
    // Y sigue contando como algo que requiere su atención.
    await expect(c.getByText(/1 requiere tu acción/i)).toBeVisible();
  },
};

/** Fila sana: no puede contradecirse a sí misma (badge verde + "desde el X no llegan..."). */
export const TodoAlDia: Story = {
  name: "Todo al día",
  args: { sources: [SANA] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Todas las conexiones están al día.")).toBeVisible();
    await expect(c.getByText(/Última carga: 27 .*jun/i)).toBeVisible();
    await expect(c.queryByText(/no llegan documentos/i)).toBeNull();
  },
};

/** Ley 8: el estado de carga dice qué está pasando y cuánto suele tardar. */
export const Cargando: StoryObj<typeof ConexionesCargando> = {
  name: "Cargando (Ley 8)",
  render: () => <ConexionesCargando />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("status")).toHaveTextContent(/revisando el estado de tus conexiones/i);
    await expect(c.getByRole("status")).toHaveTextContent(/menos de 5 segundos/i);
  },
};

/** Ley 8: el vacío dice qué pasó, por qué y ofrece una salida. */
export const Vacio: StoryObj<typeof ConexionesVacio> = {
  name: "Vacío (Ley 8)",
  render: () => <ConexionesVacio />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No hay ninguna fuente que mostrar/i)).toBeVisible();
    await expect(c.getByText(/todavía no se le asignó ninguna/i)).toBeVisible();
    await expect(c.getByRole("link", { name: "Conectar una fuente" })).toBeVisible();
  },
};
