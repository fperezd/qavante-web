# Inicio: resumen financiero (#259)

## Alcance

Se implementa la jerarquía aprobada por el BO sobre la ruta productiva `hoyV01`:
saldo bancario y necesidad/proyección a 14 días, revisión de la necesidad de caja,
gastos/costos sobre presupuesto y revisión operativa. Las evaluaciones, selección,
aprobación, lectores y actividad conservan sus componentes existentes bajo demanda.
No se reemplaza la navegación global ni se incorporan operaciones nuevas.

La petición del BO en la conversación autorizó desarrollar una vista similar al
mockup aprobado. Las cifras ilustrativas se limitan a fixtures de pruebas y stories.

## Contraste con el sistema vigente

- Base frontend: `origin/main` 75cc5533; ruta `HoyLive`, flag `hoyV01` activo en Wrangler.
- Antes: veredicto general, múltiples paneles completos, indicadores y actividad.
- Ahora: dos importes principales y detalles cerrados. Una caja sin déficit no
  oculta la desviación presupuestaria ni la primera acción del servidor.
- El dashboard publica CLP y necesidad a 14 días, no un equivalente multimoneda
  verificable ni la fecha exacta del primer faltante. No se inventan esos campos.
- La evaluación persistida del tenant puede tener otra entidad/corte/horizonte.
  No se promociona su alternativa como solución de la brecha del dashboard.
- `cash_gap_amount_14d` se muestra directamente; no se suma a obligaciones ni se
  atribuye al umbral configurado (el cálculo vigente corresponde al valle bajo cero).
- El crédito detallado disponible corresponde a BICE, se rotula como tal y se
  presenta por cuenta/moneda sin sumarlo al saldo. HTTP 200 con estado de error
  sigue siendo error, no ausencia de cupo.
- Presupuesto: mes anterior en Santiago, importes signados y `variance` del servidor.
  Costos directos y gastos no se compensan. `Ver detalle` abre Presupuesto,
  cuyo período predeterminado es también el mes anterior.

## Invariantes y validación

Riesgo R2 por presentación financiera. Sin cambios de backend, OpenAPI, autenticación,
permisos ni nuevas mutaciones. `types.ts` no se modifica.

- Nulo/ilegible no es cero; errores y fuentes parciales no se convierten en éxito.
- Un saldo final positivo no borra un faltante intermedio.
- El aviso favorable exige fuentes fechadas en el día de Santiago y datos compatibles.
- Las fechas/limitaciones de la proyección se ven junto al importe.
- El crédito no se suma a caja ni se completa mediante uso supuesto.
- Selección y aprobación siguen usando sus controles, permisos y confirmaciones previas.
- 40 tests focalizados de modelos, crédito, propuestas y selector de caja: PASS.
- 5 stories en Chromium (déficit, sin déficit, nulos, antiguos y celular): PASS.
- Typecheck y lint focalizado: PASS.
- Capturas de la implementación inspeccionadas en escritorio (1200 px) y celular
  (360 px), con datos de ejemplo. Sin desborde horizontal a 360 px.
- Revisión R2 en sesión independiente: cuatro hallazgos corregidos; pase final PASS.
  La revisión fue bajo la misma identidad del BO y no sustituye el human gate de integración.

La validación local reutiliza dependencias instaladas mediante junction. El allowlist
local de Vite usado para las stories no forma parte del cambio versionado.

## Entrega y rollback

No se despliega ni se modifica producción en este corte. CI y human gate siguen
pendientes para la integración. Revertir este cambio restaura `HoyView` en `HoyLive`;
no hay datos que migrar ni escrituras que revertir.

Limitaciones deliberadas: sin equivalencia FX inventada, sin cupos agregados de bancos
sin lector, sin costo/neto ilustrativo y sin asociación falsa entre evaluación y brecha.
Los detalles de decisión mantienen por ahora el lenguaje de sus paneles existentes.

## Ajuste de niveles móviles solicitado por el BO

- Ante un faltante, proyección y acción comparten la primera tarjeta. Sin faltante,
  se conserva el saldo primero. El orden DOM coincide con el visual también en escritorio.
- La evaluación se monta una sola vez, bajo demanda; antes de sus alternativas se
  aclara que debe comprobarse su fecha, moneda y horizonte. No se agrega una recomendación.
- Al abrir la decisión desde tablet, la tarjeta ocupa toda la fila para dar espacio
  a los paneles existentes. No se duplica el contenido entre breakpoints.
- Crédito: superficie secundaria dentro del saldo, campos Disponible / Cupo total
  alineados por cuenta y moneda, sin alterar su lectura financiera.
- Gastos/costos: concepto, mes y exceso primero; comparación en el mismo lugar al
  desplegar, con enlace al detalle existente de Presupuesto.
- Revisión operativa, actividad y fuentes se agrupan en filas desplegables. Se usa
  `details/summary` nativo, foco visible y chevron; no hay navegación nueva.
- La fecha y advertencia de proyección desactualizada siguen junto al importe.
- Validación: 40 tests y 5 stories PASS; apertura/cierre con Enter comprobados;
  decisión expandida sin desborde horizontal a 320, 360, 390, 768, 900 y 1200 px.
  Capturas de entrada móvil, comparación abierta y tablet/escritorio inspeccionadas.
- Nueva revisión independiente PASS después de corregir el ancho del detalle en tablet.
  Integración, CI y aprobación humana siguen pendientes; no se publica producción.
