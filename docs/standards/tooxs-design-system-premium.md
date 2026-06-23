# Tooxs Design System — Especificación Premium

> **Versión:** 1.0 · **Estado:** Activo · **Fecha:** 2026-06-23
> **Complementa:** [Tooxs Frontend Standard](./tooxs-frontend-standard.md) (la
> ingeniería). Este documento es la **capa de craft**: lo que separa "correcto"
> de "caro". Agnóstico de dominio.

El Frontend Standard garantiza que el producto _funcione bien_. Este documento
garantiza que se _sienta premium_. Premium no es más decoración — es **menos, mejor
ejecutado**: jerarquía clara, ritmo consistente, movimiento con propósito y
performance percibida. Acá están los **números**, no las opiniones.

---

## 0. Los 7 principios de "caro"

1. **Restraint.** Un acento, no cinco. Una acción primaria por vista. El lujo es el
   espacio en blanco, no el relleno.
2. **Jerarquía brutal.** En cada pantalla, una sola cosa es la más importante y se
   nota a 2 metros. Si todo grita, nada se escucha.
3. **Ritmo consistente.** Todo espaciado sale de **una** escala. El ojo detecta el
   "casi alineado" como barato.
4. **Movimiento con propósito.** Se anima para explicar continuidad o dar feedback,
   nunca para decorar. 150–250ms, curvas naturales.
5. **Performance percibida > performance real.** Skeleton que anticipa, optimistic
   UI, transiciones que tapan la latencia. El usuario siente, no mide.
6. **Datos legibles.** `tabular-nums`, alineación a la derecha, jerarquía de peso. Un
   número mal alineado arruina un dashboard entero.
7. **Consistencia > creatividad.** El mismo patrón resuelto igual en todas partes. La
   sorpresa es enemiga de la confianza.

---

## 1. Espaciado — base 4pt

Única escala. **Prohibido** un margen que no esté acá.

| Token       | px  | Uso                                              |
| ----------- | --- | ------------------------------------------------ |
| `space-0.5` | 2   | Ajuste óptico fino                               |
| `space-1`   | 4   | Gap icono↔texto                                  |
| `space-2`   | 8   | Padding interno chico, gap de items en lista     |
| `space-3`   | 12  | Padding de control (botón), gap de cards en grid |
| `space-4`   | 16  | Padding de card, gap estándar                    |
| `space-5`   | 20  | —                                                |
| `space-6`   | 24  | Separación entre secciones de una vista          |
| `space-8`   | 32  | Separación entre bloques mayores                 |
| `space-12`  | 48  | Padding vertical de empty states / heroes        |
| `space-16`  | 64  | Márgenes de página en desktop                    |

**Regla de ritmo:** dentro de un componente, los espaciados suben de a un paso
(8→12→16), nunca saltos arbitrarios (8→13). El layout de página usa `space-6`/`space-8`
entre secciones; el interior de cards usa `space-4`.

---

## 2. Tipografía — escala modular

Un tipo (p. ej. Sora/Inter), escala ~1.25. Cada nivel define **size / line-height /
weight / tracking**.

| Token         | size/lh  | weight | tracking | Uso                                             |
| ------------- | -------- | ------ | -------- | ----------------------------------------------- |
| `display`     | 36/40    | 700    | -0.02em  | Cifra héroe, número que responde "¿estoy bien?" |
| `title`       | 24/32    | 700    | -0.01em  | Título de pantalla (h1)                         |
| `heading`     | 18/28    | 600    | 0        | Sección / card header                           |
| `body`        | 15/24    | 400    | 0        | Texto base                                      |
| `body-strong` | 15/24    | 500    | 0        | Dato dentro de texto                            |
| `caption`     | 13/20    | 400    | 0        | Metadatos, ayudas                               |
| `overline`    | 11/16    | 600    | 0.06em ↑ | Labels de sección (UPPERCASE)                   |
| `data`        | variable | 500    | 0        | **Siempre `tabular-nums`** para cifras          |

**Reglas premium:**

- Títulos y cifras héroe: tracking negativo (se ven más sólidos/caros).
- Labels overline en mayúscula + tracking positivo + color `neutral-mid`.
- Máximo **2 pesos** por pantalla además del dato. Nada de 300/400/500/600/700 todo
  junto.
- Line-height más generoso en body (1.6) que en títulos (1.2–1.3).
- Texto largo: ancho máximo **~65ch** (`max-w-prose`). Líneas anchas = barato.

---

## 3. Color — cómo se aplica (no solo qué tokens)

Los tokens están en el Frontend Standard §4.1. Acá la **disciplina de aplicación**:

- **Regla 60–30–10:** ~60% superficie/neutral, ~30% texto/estructura, ~10% acento. El
  acento es escaso **a propósito** — si está en todos lados, no acentúa nada.
- **Semánticos solo comunican estado.** `danger` nunca se usa como color decorativo.
- **Profundidad por tinte, no solo por sombra:** superficies elevadas suben de tono
  frío sutil; sombras tintadas con el navy de marca, **nunca negro puro** (el negro
  puro se ve barato y "sucio").
- **Texto:** jerarquía por color, no solo por peso — `foreground` (primario),
  `neutral-mid` (secundario), `neutral` (terciario/disabled). Contraste AA mínimo
  (4.5:1 body, 3:1 títulos grandes).
- **Bordes:** de bajo alfa frío (`rgba(navy, .1)`), no grises planos cálidos.

---

## 4. Elevación y profundidad

5 niveles. Sombra = distancia a la superficie, no decoración.

| Nivel | Token       | Uso                               |
| ----- | ----------- | --------------------------------- |
| 0     | flat        | Fondo de página, contenido inline |
| 1     | `shadow-sm` | Card en reposo                    |
| 2     | `shadow-md` | Card hover / dropdown             |
| 3     | `shadow-lg` | Popover, card destacado           |
| 4     | `shadow-xl` | Dialog / sheet                    |

Sombras **en capas** (una corta densa + una larga difusa) y **tintadas**. Z-index en
escala fija: `base 0 · dropdown 10 · sticky 20 · overlay 30 · modal 40 · toast 50`.
Nada de `z-index: 9999`.

---

## 5. Radios y forma

| Token         | px  | Uso                      |
| ------------- | --- | ------------------------ |
| `radius-sm`   | 4   | Badge, tag, input chico  |
| `radius-md`   | 8   | Input, botón             |
| `radius-lg`   | 12  | Card                     |
| `radius-xl`   | 16  | Dialog, contenedor mayor |
| `radius-full` | 999 | Avatar, pill, dot        |

**Regla de anidamiento:** el radio interno < externo (un elemento dentro de una card
`lg` usa `md`), si no se ve "despegado". Consistencia de radio en todo el producto:
elegir una familia y no mezclar.

---

## 6. Movimiento — tokens y reglas

Premium se nota en el movimiento. Pero **movimiento con propósito**.

| Token           | duración | curva                      | Uso                                      |
| --------------- | -------- | -------------------------- | ---------------------------------------- |
| `motion-fast`   | 120ms    | `ease-out`                 | Hover, press, focus, toggle              |
| `motion-base`   | 200ms    | `cubic-bezier(.2,.8,.2,1)` | Entrada de contenido, expand             |
| `motion-slow`   | 320ms    | `cubic-bezier(.2,.8,.2,1)` | Overlays, sheets, transiciones de página |
| `motion-spring` | —        | spring suave               | Microinteracciones de éxito              |

**Curvas:** entradas con `ease-out` (rápido→lento, se sienten naturales); salidas con
`ease-in`. **Nunca** `linear` para UI (se siente mecánico) ni `ease-in-out` largo
(se siente lento).

**Qué animar:** aparición de contenido (fade+8px up), hover de cards (elevar 2px +
sombra), press (scale 0.98), expand/collapse, entrada de toasts/dialogs, cambios de
estado de datos.
**Qué NO animar:** texto que el usuario va a leer ya, cambios de layout que muevan el
contenido bajo el cursor, nada que retrase una acción.

**`prefers-reduced-motion`:** obligatorio. Se reemplaza translate/scale por
fade simple o se desactiva. No es opcional.

---

## 7. Microinteracciones (catálogo)

| Interacción                 | Estándar premium                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Hover (card clickeable)** | Eleva 2px + `shadow-md` + borde de acento sutil + flecha que avanza 2px. Todo el card reacciona, no solo el link.     |
| **Press**                   | `scale(0.98)`, `motion-fast`. Da fisicalidad.                                                                         |
| **Focus**                   | `ring-2 ring-offset-2` de acento, siempre visible con teclado (`focus-visible`). Nunca `outline: none` sin reemplazo. |
| **Loading de botón**        | Spinner inline + disable + texto se mantiene (no salta el ancho).                                                     |
| **Éxito de acción**         | Toast + microanimación (check que se dibuja).                                                                         |
| **Optimistic UI**           | La acción se refleja al instante; rollback con toast si falla.                                                        |
| **Skeleton**                | Forma que **anticipa** el contenido real, shimmer suave, no spinner.                                                  |

---

## 8. Patrones premium vs anti-patrones

La diferencia entre 7 y 10 está acá.

| Situación       | ✅ Premium                                                          | ❌ Barato                                              |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **Carga**       | Skeleton con la forma del contenido                                 | Spinner centrado genérico                              |
| **Vacío**       | Ilustración/ícono + título humano + **CTA accionable**              | "No hay datos." y nada más                             |
| **Error**       | Copy claro + acción de recuperación, sin jerga                      | `Error: 500` o `error.message` crudo                   |
| **Cifra clave** | `display`, tabular-nums, con label y origen/frescura                | Número suelto sin contexto                             |
| **Tabla**       | Header sticky, montos a la derecha, hover de fila, densidad pensada | Scroll horizontal, todo centrado                       |
| **Form**        | Validación onBlur, error inline por campo, submit con loading       | Validación agresiva onChange, errores arriba en bloque |
| **Feedback**    | Toast para la acción, inline para la carga                          | Toast para todo, o feedback ausente                    |
| **Jerarquía**   | 1 acción primaria, resto secundario/ghost                           | 4 botones azules compitiendo                           |
| **Densidad**    | Aire entre secciones, agrupación clara                              | Todo pegado, "wall of data"                            |
| **Navegación**  | Sección activa visible, breadcrumb, sin callejones                  | "Próximamente" en el menú principal                    |

---

## 9. Iconografía

- **Un solo set** (lucide), grosor consistente (1.5–2px), tamaños de la escala
  (16/20/24).
- Ícono **siempre acompaña**, nunca reemplaza el texto en acciones primarias.
- Decorativos: `aria-hidden`. Funcionales (icon-button): `aria-label`.
- Tamaño óptico: el ícono se alinea a la altura de la x del texto, no al box.

---

## 10. Visualización de datos

- Paleta de gráficos derivada de la marca (`brand-light` + análogos), no el arcoíris
  default de la librería.
- Máx ~5 series por gráfico; más → agrupar o "otros".
- Ejes sutiles (neutral, bajo alfa), grilla mínima, sin chartjunk.
- Tooltips con `tabular-nums` y formato de la moneda/locale del tenant.
- Daltonismo: nunca solo color para distinguir (sumar forma/ícono/label).
- Estado vacío de un gráfico = `Empty`, no un canvas en blanco.

---

## 11. Modos de densidad

Dos densidades como token de layout: **`comfortable`** (default, consumer) y
**`compact`** (power-user / tablas densas). Cambian padding y line-height vía
variable, no por componente. Un SaaS operativo ofrece `compact`; uno consumer se
queda en `comfortable`.

---

## 12. Pipeline de design tokens (fuente de verdad)

Premium a escala = **una sola fuente de verdad** diseño↔código.

```
Figma Variables  ──export──>  tokens.json (W3C Design Tokens)
        │                           │
        │                     Style Dictionary
        │                           ▼
        └────────────>  styles/tokens.css  (--tooxs-*)
                                    │
                            @theme inline (Tailwind)
                                    ▼
                         utilidades semánticas en componentes
```

- El diseñador edita **variables en Figma**; un export genera `tokens.json`.
- **Style Dictionary** (o equivalente) transforma a `tokens.css` — **generado, no
  editado a mano** (igual que `api/types.ts`).
- Los componentes consumen utilidades semánticas (`bg-surface`), nunca el valor.
- Dark mode y white-label = otro set de tokens, mismo pipeline, cero recompilación de
  componentes.

> Mientras no exista el pipeline, `tokens.css` es la fuente de verdad manual — pero el
> objetivo Gold es Figma→código automatizado.

---

## 13. Definition of Done "premium" (el gate de "¿se siente caro?")

Además del DoD de ingeniería (Frontend Standard §15):

1. **Espaciado** 100% de la escala 4pt (cero márgenes mágicos).
2. **Jerarquía:** una sola cosa es claramente la más importante de la pantalla.
3. **Una** acción primaria; el resto secundario/ghost.
4. **Cifras** con `tabular-nums`, alineadas, con label y origen.
5. **Estados** loading (skeleton que anticipa) / empty (con CTA) / error (recuperable)
   — los tres, premium, no genéricos.
6. **Movimiento:** entradas y hovers con tokens de motion; `prefers-reduced-motion`
   respetado.
7. **Foco** visible y orden lógico; navegable por teclado.
8. **Densidad:** aire entre secciones, agrupación clara, ancho de texto ≤65ch.
9. **Sin** color barato (negro puro en sombras, acento sobreusado, arcoíris en charts).
10. **Test de los 2 metros:** parado a 2m de la pantalla, ¿se entiende qué mirar
    primero? Si no, no está terminado.

---

> **Cómo se usa:** este documento se revisa en el **design review** de cada feature,
> junto al code review. Una pantalla no es "premium" porque alguien lo diga — pasa los
> 10 puntos del §13 o no pasa. La taste se sistematiza, no se delega al ojo.
> </content>
