# Inicio: implementación del mockup aprobado

Issue: [#265](https://github.com/tooxs-digital/qavante-web/issues/265). Riesgo: R2.
Fecha de validación local: 12-09-2026. Sin publicación ni modificación de datos de clientes.

## Alcance implementado

- Tarjetas proyección/saldo con el mismo ancho y alto en escritorio. Orden estable: proyección primero, también sin déficit.
- Celular: tarjetas apiladas, altura natural, controles de al menos 44 px y detalles desplegables.
- Déficit: faltante publicado por el servidor. Cobertura: menor saldo del período, no el saldo final ni dinero libre para gastar.
- Cobertura positiva exige las fuentes completas y vigentes que ya verificaba el modelo. Ausencia y datos antiguos no se presentan como cero ni como pagos cubiertos.
- Se retiran presupuesto, actividad y revisión operativa del Inicio, y se dejan de consultar presupuesto y bitácora desde esta vista.
- Atención: hasta tres acciones financieras publicadas hacia Cobrar/Pagar, ordenadas por prioridad, sin repetir brecha ni clasificación. Sin sección vacía.
- Opciones y seguimiento se despliegan fuera de las tarjetas, preservando lectores, permisos y confirmaciones existentes. Un error de seguimiento no oculta el acceso al reintento.
- Saldos de cuentas activas corrientes/ahorro agrupados por su moneda. Se reutiliza la agregación de Banco sobre saldos calculados por el servidor: no se descargan movimientos ni se reconstruye el forecast.
- Se excluyen tarjetas, préstamos e inversiones del saldo de cuentas. Un subtotal incompleto se identifica y las fechas se pueden consultar por cuenta. Fechas y frescura usan el mismo día civil de Santiago.
- Líneas: banco, cuenta, moneda, disponible y cupo total. Una línea visible y detalle para las restantes; sin sumar monedas ni añadir los cupos al saldo.

## Contratos y límites que se conservan

1. BankAccountItem.balance viene en moneda propia; puede proceder del banco o de apertura y movimientos en servidor. No garantiza por sí mismo que todas las fuentes estén sincronizadas. La fecha y los faltantes se muestran.
2. El lector de cupos detallados existente es únicamente BICE (CuentaBalanceResponse). El componente admite múltiples bancos y las pruebas los ejercitan, pero no hay integración nueva de cupos para otros bancos. En runtime se identifica el alcance BICE y los bancos cuyos cupos no están disponibles. Ausencia de información no equivale a línea inexistente o cupo cero.
3. CashForecast no publica la fecha exacta del mínimo. No se muestra una fecha inventada junto al importe.
4. PriorityAction no publica un estado de negociación/gestión. No se infiere que una deuda está resuelta ni se altera su incidencia en la proyección. Ese filtro requiere un contrato de servidor antes de implementarlo.
5. No cambian OpenAPI, cálculos de déficit, ejecución financiera, navegación global ni pantallas ajenas a Inicio. La ruta de actividad existente permanece sin cambios.
6. El render actual sigue sujeto a los flags existentes de Inicio y saldos bancarios. Sin el flag de saldos se mantiene el saldo CLP del resumen financiero con su estado; no se fabrican cuentas ni USD.

## Evidencia local

- 35 pruebas unitarias: modelo canónico, cupos y errores funcionales HTTP 200, varias cuentas/monedas, subtotales, fechas UTC/Santiago, orden y límites de acciones.
- 8 historias con pruebas Chromium: déficit, cobertura, ausencia de datos, datos antiguos, celular con detalles abiertos, celular sin déficit, acciones y reintento de seguimiento sin déficit.
- Medidas de ancho/alto iguales en PC y apilado/sin desborde en celular con viewport real de 390 px.
- TypeScript sin errores; ESLint sin errores; diff sin errores de espacio.
- Revisión independiente: PASS, sesión review_inicio_mockup. Los dos hallazgos P2 de recuperación de seguimiento y fecha civil fueron corregidos y probados. Excepción de identidad: reviewer en otra sesión bajo la misma identidad del BO, conforme a AGENTS.md.
- La adaptación temporal de permisos de archivos de Vite para el enlace local de node_modules no forma parte del cambio.
- Capturas de componentes con datos ficticios exclusivamente de prueba; no son datos de producción ni una nueva integración bancaria.

## Antes de publicar

Capturas: [PC con déficit](inicio-deficit-desktop.png), [PC con cobertura](inicio-cubierto-desktop.png), [celular con déficit](inicio-deficit-mobile.png), [celular con cobertura](inicio-cubierto-mobile.png).

CI completa, revisión humana R2 y autorización de publicación. Después del merge, verificar Inicio con sesión real, fuentes/flags activos y navegación móvil. La validación local no sustituye este gate.

Rollback: revertir el commit de esta implementación. No hay migraciones ni escrituras financieras que revertir.
