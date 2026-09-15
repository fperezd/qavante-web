/* Parámetros para historias que SÓLO puede ejecutar `test-storybook` (Vitest browser mode).
 *
 * Miden Ley 7 (§5.2 del rediseño: sin scroll horizontal en anchos de teléfono) reflowando la
 * ventana de verdad con `page.viewport()` de `@vitest/browser/context`. Ese módulo existe
 * únicamente dentro del runner de Vitest: en el runner de Chromatic el `await import(...)` del
 * `play` revienta con "vitest/browser can be imported only inside the Browser Mode" y la captura
 * se contabiliza como error de componente. Fueron 16 de los 51 errores de componente del build
 * 2249, que son deuda de `main`, no de un PR (issue #299).
 *
 * `chromatic.disable` saca la historia de la captura visual y NO relaja ningún gate: Chromatic
 * nunca llegó a ejecutarla. La cobertura de estas historias la sigue dando `npm run
 * test-storybook` en CI (Linux, fuentes más anchas que Windows — el runner que de verdad decide
 * si Ley 7 pasa). Si mañana una de estas historias deja de depender de `@vitest/browser/context`,
 * sacarle este parámetro la devuelve a la captura visual.
 */
export const SOLO_TEST_STORYBOOK = {
  chromatic: { disable: true },
} as const;
