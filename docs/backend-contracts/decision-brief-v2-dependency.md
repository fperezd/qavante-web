# Decision Brief V2 — boundary de integración (#559)

La interfaz actual sólo presenta literalmente el contrato generado
`cash-decision-brief.v1`. El selector de versión vive en
`src/components/decision-brief/decision-brief-renderer.tsx`: V1 llega al panel
actual; cualquier versión distinta se declara no compatible y **no** se sustituye
por rankings, cálculos ni recomendaciones locales.

La ampliación de contrato de qavante-api #559 es una dependencia explícita. Antes
de habilitar una versión V2 se requiere, en este orden:

1. actualizar el OpenAPI generado en `src/lib/api/types.ts`;
2. acordar el renderer V2 campo por campo con el contrato publicado, incluyendo
   fixtures MSW y pruebas de literalidad;
3. ampliar la suite E2E ON para la nueva versión y pasar R2 independiente;
4. mantener `NEXT_PUBLIC_FF_DECISION_BRIEF = "false"` hasta la autorización de
   activación.

No se anticipan campos, textos, importes ni CTAs de V2 en el cliente. Si el
servidor entrega una versión no soportada, la UI muestra esa incompatibilidad de
forma honesta y no fabrica una decisión alternativa.
