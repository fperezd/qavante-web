# Activación V06 Impuestos

Unidad: [web #73](https://github.com/tooxs-digital/qavante-web/issues/73). Riesgo R2.
La activación autorizada por el BO el 2026-09-09 fija
`NEXT_PUBLIC_FF_IMPUESTOS_V06 = "true"` en el `Dockerfile` de la imagen.
La página resuelve el flag en el servidor; el default de código continúa apagado.

El contrato vivo consultado el 2026-09-09 publica
`/api/sii/f29/impuesto#estimable`, `missing_inputs`, `incompleto`, `as_of`,
`input_sources` y montos nullable (API #401, consumidor web #223).
Sólo se publica un monto con estimabilidad afirmada, evaluación no incompleta,
sin insumos faltantes y desglose material presente. Un cero confirmado permanece
cero; falta de dato permanece sin dato. El frontend no recalcula impuestos.

La aceptación original sobre F29 conciliado con cargo bancario sigue pendiente:
[API #440](https://github.com/tooxs-digital/qavante-api/issues/440).
La pantalla mantiene el hueco visible y el comprobante enlaza al F29 del SII.
Esta activación no demuestra conciliación bancaria ni cierra toda la aceptación de #73.

Verificación: tests de ruta ON/OFF/ausente/inválido y kill-switch; regresores V06
de datos incompletos, ceros y Ley 9; smoke sin sesión y smoke autenticado con
`SMOKE_RUT`/`SMOKE_PASSWORD`. El smoke autenticado omitido por falta de credenciales
no cuenta como validación de datos reales. Tras merge se requiere el
[despliegue Azure PROD](./deploy-runbook.md) y recorrido autenticado de
`/impuestos`, incluyendo fuentes/frescura y límite visible.

Rollback: cambiar sólo el flag a `"false"` en el `Dockerfile` y ejecutar el
despliegue Azure. La ruta vuelve al estado no disponible con acceso a
`/pagar/impuestos` y `/pagar/previred`.
