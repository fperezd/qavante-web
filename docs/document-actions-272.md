# Gestión de pagos, cobros y seguimiento

Implementación de #272. Depende de `tooxs-digital/qavante-api#540` y su snapshot OpenAPI.
Riesgo R2. No publicada.

- Inicio: accesos a gestionar pagos y cobros dentro de opciones y seguimiento.
- Pagar/Cobrar: gestionar documento, registrar abono o pago completo, confirmar coincidencia sugerida y programar seguimiento.
- Consulta explícita de documentos en seguimiento; los totales financieros no se reducen por ocultar prioridades.
- Pago manual y conciliación bancaria diferenciados. Vincular un movimiento después no vuelve a descontar el importe.
- Formularios con confirmación, carga, error y reintento; ninguna acción ejecuta una transferencia.
- Ventana adaptada al ancho disponible, desplazamiento interior, cierre con Escape y restitución del foco.

Validación local: 81 pruebas de vistas, dos historias de navegador (abono y seguimiento), TypeScript y ESLint. Tipos generados desde OpenAPI. Pendientes: CI completa, validación integrada con API nueva y comprobación visual móvil en preview. No se afirma validación productiva.

Publicación: API y migración antes de WEB, revisión independiente y aprobación R2. No auto-merge. Rollback de WEB antes de API; conservar el historial financiero.
