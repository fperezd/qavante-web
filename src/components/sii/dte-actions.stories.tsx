import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, userEvent, expect } from "storybook/test";
import { DteActions } from "./dte-actions";

/* Vista previa de un DTE. El PDF lo genera el SII en vivo (~2,94 s medidos), así
   que el estado de carga es el estado NORMAL de este componente, no una rareza:
   por eso tiene stories y tests propios. El popover va en portal a `document.body`,
   así que las aserciones consultan el body, no el canvas de la story. */

const URL_PDF = "https://api.qavante.test/api/sii/dte/1234/pdf";

/** Nunca responde: congela el componente en el estado de carga para poder verlo. */
const CARGA_ETERNA = http.get(URL_PDF, async () => {
  await delay("infinite");
  return HttpResponse.json({});
});

/** Respuesta HTML = el SII devolvió su página de login → sesión/certificado caído. */
const SESION_CAIDA = http.get(
  URL_PDF,
  () =>
    new HttpResponse("<html><body>Iniciar sesión</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

const meta = {
  title: "SII / DteActions",
  component: DteActions,
  parameters: { layout: "centered" },
  args: { url: URL_PDF, label: "folio 1234" },
} satisfies Meta<typeof DteActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinUrl: Story = {
  args: { url: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("s/d")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /Vista previa/ })).toBeNull();
  },
};

/**
 * U3 — el corazón del arreglo: el primer frame del popover ya dice qué está
 * pasando, dónde y cuánto tarda. Antes había un spinner mudo durante ~2,7 s.
 */
export const CargaDiceQueEstaPasando: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" }));

    // Sin `findBy`: tiene que estar YA, no "en algún momento".
    await expect(body.getByText("Buscando el documento en el SII…")).toBeVisible();
    await expect(body.getByText(/suele demorar unos 3 segundos/)).toBeVisible();
  },
};

/**
 * El gesto cambió de hover a click (ver el comentario en `dte-actions.tsx`):
 * pasar el mouse por encima ya no dispara una consulta al SII ni abre nada.
 */
export const ElHoverNoAbreNada: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" });

    await userEvent.hover(trigger);
    // Holgado sobre los 280 ms del delay de hover que existía antes.
    await new Promise((r) => setTimeout(r, 600));

    await expect(body.queryByRole("dialog")).toBeNull();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * A11y del diálogo: al abrir, el foco ENTRA al panel. El portal cuelga del final
 * del `body`, así que sin esto el ✕ y el CTA quedan después de toda la página
 * para quien navega con teclado o lector de pantalla. Y con el foco adentro,
 * Tab circula por el diálogo en vez de escaparse a la tabla de atrás.
 */
export const ElFocoEntraAlDialogo: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" }));

    await expect(await body.findByRole("button", { name: "Cerrar la vista previa" })).toHaveFocus();
  },
};

/**
 * La retención de foco, probada donde SIGNIFICA algo: con DOS controles.
 *
 * La versión anterior de este test usaba el estado de carga, donde el ✕ es el
 * único focusable — un caso degenerado que cualquier implementación pasa, hasta
 * una que no hace nada. Acá el panel de sesión SII caída tiene ✕ y el CTA "Ir a
 * Credenciales", así que se puede verificar el ciclo real en las dos
 * direcciones: Shift+Tab desde el primero va al último, Tab desde el último
 * vuelve al primero.
 *
 * Lo que este test NO cubre, y no puede: el estado `ready`. Con el PDF cargado
 * el foco puede entrar al `iframe`, y desde otro documento el `keydown` no
 * burbujea acá — la retención se fuga y Escape deja de cerrar. Por eso el
 * diálogo NO declara `aria-modal` (ver `NoPrometeModalidad`).
 */
export const ElFocoCirculaEntreLosControlesDelPanel: Story = {
  parameters: { msw: { handlers: [SESION_CAIDA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" }));

    const cerrar = await body.findByRole("button", { name: "Cerrar la vista previa" });
    const credenciales = await body.findByRole("link", { name: /Ir a Credenciales/ });
    await expect(cerrar).toHaveFocus();

    // Shift+Tab desde el primero → envuelve al último.
    await userEvent.tab({ shift: true });
    await expect(credenciales).toHaveFocus();

    // Tab desde el último → vuelve al primero.
    await userEvent.tab();
    await expect(cerrar).toHaveFocus();

    // Y hacia adelante desde el primero se llega al segundo sin salir del panel.
    await userEvent.tab();
    await expect(credenciales).toHaveFocus();
  },
};

/**
 * El diálogo no declara `aria-modal`, a propósito: sería prometerle al lector de
 * pantalla que el fondo no está disponible, cuando con el PDF cargado sí se
 * puede tabular hacia él. Este test existe para que nadie lo "arregle"
 * agregándolo sin cerrar antes la fuga del `iframe`.
 */
export const NoPrometeModalidad: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" }));

    const dialogo = await body.findByRole("dialog");
    await expect(dialogo).not.toHaveAttribute("aria-modal");
  },
};

/**
 * Con el gesto en click, el popover necesita salidas obvias: Escape y ✕.
 *
 * El foco arranca DENTRO del diálogo (en el ✕), así que la aserción final es
 * observable: si el componente no devolviera el foco al ícono, quedaría en el
 * `body` al desmontarse el ✕ y este test caería.
 */
export const EscapeCierraYDevuelveElFoco: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" });

    await userEvent.click(trigger);
    await expect(await body.findByRole("dialog")).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // El foco NO está en el trigger: está en el ✕ del diálogo.
    await expect(trigger).not.toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).toBeNull();
    await expect(trigger).toHaveFocus();
  },
};

export const LaXCierra: Story = {
  parameters: { msw: { handlers: [CARGA_ETERNA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" });

    await userEvent.click(trigger);
    await userEvent.click(await body.findByRole("button", { name: "Cerrar la vista previa" }));
    await expect(body.queryByRole("dialog")).toBeNull();
    await expect(trigger).toHaveFocus();
  },
};

/** Sesión del SII caída: causa concreta + CTA a Credenciales (nada de spinner eterno). */
export const SesionDelSiiCaida: Story = {
  parameters: { msw: { handlers: [SESION_CAIDA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Vista previa del DTE folio 1234" }));

    await expect(await body.findByText("El SII no entregó este documento")).toBeVisible();
    await expect(body.getByRole("link", { name: /Ir a Credenciales/ })).toHaveAttribute(
      "href",
      "/administracion/credenciales",
    );
    // Ya no queda rastro del estado de carga.
    await expect(body.queryByText("Buscando el documento en el SII…")).toBeNull();
  },
};
