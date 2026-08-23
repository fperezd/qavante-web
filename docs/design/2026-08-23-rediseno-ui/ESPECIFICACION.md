# Qavante — Especificación técnico-funcional del rediseño UI

**Versión 1.0 · 23-08-2026 · Para implementación con Claude Code**
**Archivo compañero:** `qavante-ui.html` — es la referencia visual canónica de las 21 vistas. Este documento define el comportamiento; el HTML define el aspecto. Ante conflicto, este documento manda en lógica y el HTML manda en visual.

---

## 0. Contexto para el implementador

Qavante es una plataforma de inteligencia financiera para pymes/medianas chilenas (dueño o CFO como usuario). El producto actual funciona (app.qavante.com) pero su UI tiene deuda: este rediseño la reemplaza pantalla por pantalla **sin cambiar el motor de datos existente** en las Fases 1–2, y deja lista la UI para el motor de decisión (release 1.2) en Fase 3.

Principio rector del producto: **el usuario revisa y aprueba; no opera**. La UI presenta juicio (veredictos, sugerencias, decisiones preparadas) sobre registros siempre auditables.

Arquitectura de dos modos:

- **Modo Piloto** (Hoy, memos, bandeja, bitácora): Qavante te encuentra.
- **Modo Explorar** (el resto de las vistas): tú vas a buscar. Todo número del Piloto enlaza a su módulo; todo módulo puede escalar a una decisión.

---

## 1. Design system (tokens y componentes)

### 1.1 Color — roles, no gustos

| Token        | Hex                                                          | Uso exclusivo                                          |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| `porcelana`  | `#F5F6F9`                                                    | Fondo único de la app                                  |
| `superficie` | `#FFFFFF`                                                    | Cards, tablas, paneles                                 |
| `tinta`      | `#10182B`                                                    | Texto principal, botón primario, tab activo            |
| `tinta-2`    | `#3D4660`                                                    | Texto secundario                                       |
| `tinta-3`    | `#6B7488` / `#9AA3B5`                                        | Metadatos, labels                                      |
| `hairline`   | `#E6E9F0` (bordes) / `#EDEFF4`–`#F0F2F6` (divisores de fila) | Separación; nunca sombras fuertes                      |
| `azul`       | `#2A4BE0`                                                    | SOLO enlaces y acción secundaria. Nunca fondo grande   |
| `verde`      | `#1B8A52` (soft `#E3F2E9`)                                   | Veredictos positivos, estados ✓                        |
| `ámbar`      | `#7A5A12` (soft `#F7EFD9`)                                   | Atención, "requiere tu acción"                         |
| `rojo`       | `#B4231B` (soft `#F8E7E5`)                                   | **Solo crítico Y accionable. Máx. 1 uso por pantalla** |
| `neutro`     | `#EDEFF4` texto `#6B7488`                                    | Estados informativos                                   |

### 1.2 Tipografía — dos voces

- **Fraunces** (serif, Google Fonts, weights 400/500/600): titulares de página, veredictos, cifras protagonistas. Es "lo que Qavante te dice".
- **Figtree** (400/500/600/700): todo lo operable — cuerpo, botones, tablas, formularios. Es "lo que tú haces".
- **Spline Sans Mono** (400/500/600): eyebrows/labels (uppercase, letter-spacing .10–.14em, 10–12px), folios y metadatos técnicos.
- Cifras en columnas: `font-variant-numeric: tabular-nums` SIEMPRE.
- Titular de página (`h1.page`): Fraunces 500, 28–34px, una pregunta o veredicto. Cada vista tiene UNA pregunta.

### 1.3 Componentes canónicos (ver clases en el HTML de referencia)

| Componente            | Clase ref.                       | Comportamiento                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome/nav superior   | `.chrome`                        | Fija. Items: Hoy · Caja · Banco · Cobrar · Pagar · Impuestos · Gestión · Presupuesto. Derecha: badge `Bandeja · N` (N = excepciones pendientes), campana `🔔 N` (N = SOLO alertas críticas accionables), avatar. Activo: bold + underline 2px tinta                                                                                                                                                                         |
| Tarjeta KPI           | `.kp` en `.kpi3/.k4/.k5`         | Label mono + valor Fraunces + detalle. Variante con selector de período `.per`                                                                                                                                                                                                                                                                                                                                              |
| Banner accionable     | `.band`                          | Border-left 3px (azul default, ámbar `.warn`, verde), 1 mensaje + 1 CTA pill oscura. Dismissible cuando es contextual                                                                                                                                                                                                                                                                                                       |
| Tabla estándar        | `.tw > table.t`                  | Header mono uppercase sticky, filas con `td.c1` (principal, nunca truncar) + `.sub` (metadato, truncable con tooltip), montos `.amt` derecha tabular, estados `.pillp`, acciones como links derecha. Footer `.twf`: conteo total + Exportar + paginación `‹ 1 · 2 · 3 … N ›`. Orden por columna clickeando header. Sin scroll horizontal: en viewport angosto colapsar columnas de metadato, jamás la principal ni el monto |
| Pills de estado       | `.pillp pp-ok/warn/bad/mut/blue` | Texto corto, 10.5px bold. Un solo sistema en toda la app                                                                                                                                                                                                                                                                                                                                                                    |
| Chips de filtro       | `.fchips`                        | SIEMPRE con conteo ("Vencidos · 99"). Activo = fondo tinta                                                                                                                                                                                                                                                                                                                                                                  |
| Card de decisión/memo | `.dec`                           | why (contexto) + h3 Fraunces + impact + acciones. Botón primario `.btnp` (pill tinta) con atajo `.kbd` visible                                                                                                                                                                                                                                                                                                              |
| Evidencia dos lados   | `.twoside`                       | Banco ⇄ documento, con folio/fecha/monto ambos lados                                                                                                                                                                                                                                                                                                                                                                        |
| Chips de evidencia    | `.why-strip`                     | Cada chip = verificación real del motor; si no se cumple, no se renderiza                                                                                                                                                                                                                                                                                                                                                   |
| Bitácora              | `.done`                          | ✓ verde + frase con negritas + link Ver                                                                                                                                                                                                                                                                                                                                                                                     |
| Progreso              | `.progress`                      | Barra + texto "N de M · $X ya contados"                                                                                                                                                                                                                                                                                                                                                                                     |
| Barras de flujo       | `.bars`                          | Entradas tinta, salidas rosado `#D8B9B5`, crítico rojo. Etiquetas mono                                                                                                                                                                                                                                                                                                                                                      |

### 1.4 Formatos transversales

- Fechas: `23 ago` (corto), `23 ago 2026` (largo), relativo con contexto: `hace 73 días`. UN solo formato por tipo en toda la app.
- Montos CLP: `$1.121.250` (punto miles, sin decimales). Negativos con `−` (U+2212). USD: `US$1.240`.
- Toda cifra agregada lleva "apellido" cuando hay ambigüedad posible: `Vencido · bruto ⓘ`. El ⓘ abre popover con: definición, qué incluye/excluye, fuente y frescura.
- Tono: chileno, tuteo consistente (NUNCA voseo), sin jerga interna ("Pulso" no existe; se llama Alertas).

---

## 2. Las diez leyes (constraints NO negociables)

1. El número manda, la prosa acompaña — y toda cifra lleva apellido. Un mismo concepto NUNCA muestra dos valores distintos en dos pantallas sin explicación (usar el mismo endpoint/definición).
2. Rojo = crítico y accionable. Máximo una vez por pantalla. Pendientes administrativos = progreso (neutro/verde), nunca alarma.
3. Ninguna sugerencia sin evidencia dura. Sin RUT en glosa Y sin monto que calce → no hay sugerencia; va a revisión manual. Los chips de "por qué" solo se muestran si la verificación pasó.
4. Aprobar = hecho, con ventana de arrepentimiento. Ninguna acción hacia terceros sale sin countdown visible y cancelable.
5. Todo lo automático deja bitácora con Deshacer (7 días).
6. Ningún botón deshabilitado mudo: el primario siempre responde; si falta algo, al pulsar se marca en rojo qué falta. Ningún toast tapa acciones: top-right, 5s auto-dismiss, con Deshacer cuando aplica.
7. El dato primario (contraparte, monto) no se trunca jamás. Metadatos truncan con tooltip. Sin scroll horizontal de página.
8. Estados vacíos y cargas siempre hablan: qué falta, por qué, cuánto tarda, botón que lo resuelve. "Cargando…" infinito prohibido; skeletons llevan texto y ETA.
9. Mover plata siempre lleva firma humana. Impuestos y sueldos jamás entran en postergaciones automáticas.
10. Una pantalla, una pregunta. En crisis: MENOS interfaz (una frase, un plan, dos botones), nunca más rojo.

---

## 3. Especificación por vista

> Leyenda **Datos**: ✅ = existe hoy en producción (verificado en sesión del 23-08) · 🔧 = componer/exponer sobre datos existentes (API liviana) · 🏗 = backend nuevo (release 1.2 / Fase 3, construir UI detrás de feature flag).

### V01 · Hoy (el parte del día) — ruta `/`

- **Pregunta:** ¿Cómo está mi empresa y qué necesita mi OK?
- **Estructura:** (1) crumb fecha+empresa+frescura banco; (2) titular-veredicto con estado {sana ✅verde | atención ámbar | crisis rojo} + "hay N cosas que necesitan tu OK"; (3) subtítulo 2 líneas de contexto; (4) sección "Esperando tu visto bueno" con cards de decisión (máx 3); (5) "Mientras no estabas" bitácora (máx 5, link a completa); (6) strip de 4 indicadores: Caja hoy, Resultado mes, Te deben, Value Ledger.
- **Estados del titular (Ley 10):** día perfecto → "No hay nada que necesite tu OK" + bitácora y termina; crisis → solo la decisión crítica, resto de secciones ocultas.
- **Datos:** cifras e insights ✅ (existen en Inicio actual); cards de decisión 🏗 (motor 1.2 — mientras no exista, la sección muestra las acciones prioritarias actuales de "qué hacer primero" ✅ con CTA a su módulo); bitácora 🏗.
- **Aceptación:** con motor apagado (flag off), la vista funciona 100% con datos actuales; titular calculado por reglas simples (caja<0 a 14d → atención; sueldos en riesgo → crisis).

### V02 · Caja — `/caja`

- **Pregunta:** ¿Me alcanza la caja?
- **Estructura:** tríada KPI (Hoy con chip banco+hora✓ / Entra 14d / Sale 14d con postergable); banner deuda de datos → bandeja; barras 4 semanas + "¿cómo se calcula? ⓘ"; tabla "Qué te lleva al punto más bajo" (pagos del día crítico, acción Postergar▾/Pagar por fila); footer con exclusiones del cálculo.
- **Datos:** todo ✅ (proyección, mínimos, postergables y pagos existen hoy). Banner de excepciones: count+suma de sin clasificar ✅.
- **Aceptación:** el saldo "Hoy" es EXACTAMENTE el mismo valor y fuente que en V01 y V03 (Ley 1). Postergar▾ abre opciones (7/15/30 días) y registra en bitácora cuando exista; mientras, edita fecha estimada ✅.

### V03 · Banco — `/banco`

- **Estructura:** tabla de cuentas (nombre+nº parcial, `.sub` frescura + pendientes, pill estado conexión, saldo, link cartola); banner "conectar otro banco"; filtros con conteo (Todos/Abonos·N/Cargos·N/Por conciliar·N); tabla movimientos: glosa resumida como principal (contraparte extraída si existe ✅ — el parser ya la saca), `.sub` fecha+cuenta+categoría, pill ciclo de vida {Conciliado✓/Clasificado✓/Por clasificar→CTA}, monto con signo/color, paginado 50/página.
- **Datos:** ✅ todo. Estado "Actualizando" con ETA 🔧 (exponer progreso del sync si existe; si no, texto fijo "~30 s").
- **Aceptación:** buscar filtra por glosa/RUT/monto; "Por clasificar" en fila abre la bandeja con ese ítem cargado.

### V04 · Cobrar — `/cobrar`

- **Estructura:** crumb con estado de gestión como chip gris (NUNCA banner verde de celebración — Ley 2); 5 tarjetas aging (Vigente/1-30/31-60/+61/Vencido·bruto ⓘ) con % del total; banner concentración ("3 clientes = $X del vencido" + CTA "Enviar a los 3"); filtros con conteo; tabla clientes: nombre completo, `.sub` vencido+días+última gestión, pill antigüedad (bad>60d, warn 1-60d, ok pagando), saldo, acciones WhatsApp·correo·Recordatorio (conservar los flujos actuales ✅).
- **Datos:** ✅ (días de vencido por factura existen; buckets = agrupación front). Concentración ✅ (Clientes 360 ya la calcula).
- **Aceptación:** "Recordatorio" usa las plantillas actuales; "Enviar a los 3" = bulk de las mismas. Total del footer = "por cobrar (bruto)" con ⓘ que explica diferencia vs. el neto conciliado.

### V05 · Pagar — `/pagar`

- **Estructura:** tríada (Vencido / Por pagar·selector período / Crítico vs. caja); banner postergables → link a decisión de Hoy (la ejecución masiva NO vive aquí); filtros con conteo (incluye Impuestos, Remuneraciones); tabla: proveedor completo, vence absoluto+relativo rojo, pill tipo {Negociable/Servicio/Crédito/Revisar}, monto, "detalle ▾". Fila con anomalía (posible duplicado) lleva pill roja Revisar + `.sub` explicando.
- **Datos:** ✅. Detección de duplicados 🔧 (regla simple: mismo RUT+monto±1%+30 días).
- **Aceptación:** ordenado por urgencia default; NO existe botón "pagar todo".

### V06 · Impuestos — `/impuestos` (vista nueva, datos existentes)

- **Estructura:** tríada (Próximo vencimiento / F-29 mes en curso estimado / Deudas TGR); tabla calendario: F-29 pagado (conciliado con cargo banco ✓ → link comprobante), F-29 por declarar con estimación y desglose IVA débito−crédito, Previred programado, PPM, TGR estado.
- **Datos:** pagos SII/TGR/Previred ✅ (entran y se clasifican hoy); estimación F-29 🔧 (débito−crédito desde DTEs del mes: cálculo nuevo simple); fechas de vencimiento = calendario tributario estático.
- **Aceptación:** footer fijo: "Las obligaciones tributarias nunca se postergan desde Qavante" (Ley 9).

### V07 · Bandeja de excepciones — `/bandeja`

- **Estructura:** header "N pendientes · ~X min" (X = N×80s) + tabs `Conciliar · N` / `Clasificar · N`; barra progreso "N de M resueltos hoy · $X ya contados en tu caja"; UNA card a la vez, auto-avance al resolver.
- **Card conciliar:** why (por qué no lo resolvió solo), twoside banco⇄factura candidata (folio/fecha/monto AMBOS lados — los candidatos ✅ ya existen en el endpoint de "elegir otro"), why-strip de evidencia real (Ley 3), línea de diferencia/parcialidad, acciones: `Sí, conciliar [Enter]` / `No es esta [N]` / `Buscar otra [B]` / `Saltar [→]`. "No es" registra feedback negativo del par.
- **Card clasificar:** UNA decisión (categoría). Sugerencia primero si existe regla ✅; sin evidencia → sin sugerencia + 3 frecuentes por monto/dirección. Vistas de gestión y notas tras "+ Agregar detalle (opcional)". Guardar nunca deshabilitado (Ley 6). Tras clasificar manual: oferta de regla en una línea ("¿Siempre X para este RUT? [Crear regla]" — endpoint de reglas ✅).
- **Lotes:** si hay ≥3 ítems de la misma contraparte → banner "Hay N más de X → ¿clasificarlos todos? [Sí, los N][Revisar uno a uno]" 🔧 (group-by + bulk).
- **Toast:** top-right, contraparte+monto, Deshacer, 5s (Ley 6). Deshacer 🔧 (endpoints de reversión — confirmar con CTO; el diseño los asume).
- **Aceptación:** flujo con sugerencia = Enter y avanza; manual ≤ 2 clics + categoría; bandeja vacía → estado celebratorio sobrio + "tu caja proyectada ahora incluye todo".

### V08 · Gestión — `/gestion` (una vista, 6 tabs; hoy son 9 páginas ✅)

- **Tabs:** Resultado / Márgenes / Tendencia / Comparativo / Clientes 360 / Proveedores 360. (Costos y gastos, Ciclo de caja y Punto de equilibrio se integran como secciones: Costos dentro de Resultado expandido; Ciclo y Equilibrio como bloque en Márgenes o tab propio — ver HTML 08·D.)
- **Resultado:** insight del mes (1 frase, verde si positivo) + pivote May/Jun/Jul con filas expandibles hasta documento (▾ subcategoría → filas `.exp` con folio+contraparte). **Cada monto es link** al listado de documentos que lo componen. Footer: Exportar xls + definición + "no incluye N excepciones".
- **Comparativo (regla de oro):** mes en curso SIEMPRE contra mes anterior a la misma altura (query con corte al mismo día 🔧). El mes completo se muestra gris como referencia. Esto elimina la ambigüedad de resultados duplicados.
- **Márgenes/Tendencia:** KPIs + barras; datos ✅.
- **360:** buscador de contraparte + perfil (volumen 12m, % concentración con umbral de alerta >30%, estacionalidad, mayor doc, última actividad, tabla últimos docs). ✅ existe; "días promedio en pagar" queda con su estado "en preparación" honesto.
- **Datos:** vistas ✅; drill-down al documento 🔧 (los documentos existen; falta el endpoint monto→lista); export xls 🔧.

### V09 · Presupuesto — `/presupuesto`

- Tríada Plan/Real/Desvío; tabla desvíos con pill %, monto y **link a documentos** que lo explican 🔧; banner proyección de cierre ("a este ritmo…") 🔧 (extrapolación lineal simple) + CTA Ajustar plan ✅.

### V10 · Alertas — `/alertas` (reemplaza "Pulso")

- 3 grupos: **Ahora·requiere acción** (rojo, badge del header cuenta SOLO estas), **Esta semana** (ámbar), **Para saber** (neutro, no suena). Toda alerta de los 2 primeros grupos lleva CTA (Ley: si no hay acción posible → grupo 3). Config "elegir qué me alerta". Datos ✅ (las 16 alertas actuales, re-clasificadas por reglas: crítica = accionable Y con plazo ≤7d).

### V11 · Conexiones — `/conexiones`

- Tabla de fuentes: nombre humano + `.sub` estado en lenguaje humano con FECHA de impacto ("desde el 22 ago no llegan documentos"), pill {Al día✓/Tu acción/Sin conectar}, CTA principal (Renovar certificado → flujo/instructivo SII). Mapa error-técnico→mensaje-humano 🔧 (tabla de códigos conocidos; fallback genérico + detalle técnico). Detalle técnico SIEMPRE presente pero plegado. Header global: "Con errores" → "N requiere(n) tu acción".

### V12 · Administración — `/administracion`

- **Hub:** tabla de 8 entradas con estado por fila (Credenciales muestra "1 vencida→Renovar" si Conexiones reporta problema — misma fuente).
- **12B Reglas:** render en lenguaje humano usando el mapping slug→nombre de Estructura ✅ (p.ej. `operating_expense.software_technology` → "Software y tecnología"; NUNCA mostrar slugs). Filtros por origen {Aprendidas del uso/Creadas por ti/Base Qavante/Desactivadas} + confianza como pill + "aplicada N veces, M correcciones" 🔧 (contador de aplicaciones). Governance: regla corregida 2 veces baja a "proponer" 🏗 (fase 3). Nada se borra: desactivar/reactivar ✅.
- **12C Estructura:** árbol colapsable con acciones mover/desactivar ✅; grupo "No clasificado" enlaza a bandeja. Vistas de gestión: chips; las vacías no aparecen en formularios (se activan al primer valor) 🔧. MCP: keys con estado/uso/revocar ✅ + frase fija "el asistente solo lee — nunca clasifica, concilia ni mueve plata".

### V13 · Financiamiento — `/financiamiento` 🏗 (Motor 2; UI lista, detrás de flag)

- Tríada (Deuda vigente/Costo promedio/Cupo disponible); tabla deuda (crédito con cuota+tasa+saldo, factoring histórico, línea) — datos parciales ✅ (los pagos de crédito y factoring ya se clasifican; consolidarlos como "deuda vigente" 🔧); sección solicitud activa: ofertas comparadas de financistas (recibes hoy/costo total con comisión Qavante INCLUIDA y declarada) + estados pill + Aceptar→firma 🏗 (integraciones financistas). Footer fijo: "puede recomendarte no financiar: la suscripción no depende de esto".

### V14 · Simulador — `/simular` 🏗 (motor 1.2)

- Input pregunta libre + 3 sugeridas contextuales; respuesta como memo: veredicto Fraunces + impacto (equilibrio, margen, caja) + condición + twoside antes/después + acciones (Guardar en memoria/Ver alternativa/Descartar). NO ejecuta nada — etiqueta "simulación · no ejecuta" visible.

### V15 · Onboarding — `/bienvenida`

- 3 pasos en una vista: fuentes con estado y tiempo estimado por conexión; progreso de construcción del modelo con verbos concretos ("leímos 412 facturas") y ETA; promesa final CON HORA ("mañana a las 7:00 llega tu primer parte"). Orquestación de conexiones existentes ✅ + eventos de progreso 🔧.

### V16 · Remuneraciones — `/pagar/remuneraciones`

- Tríada (Líquido/Cotizaciones/Costo empresa con % ingresos ⓘ); tabla por persona con estado y link liquidación. Datos ✅ (Previred). Footer Ley 9: sueldos jamás en postergaciones.

### Capa Piloto (Fase 3 — todo 🏗, UI especificada en artifact "Qavante Piloto")

Memo con alternativas y costos · ejecución con ventana de arrepentimiento (default 19 min, todo listado con estado hecho/programado/vigilando, correos legibles antes de salir, Cancelar todo) · bitácora + Deshacer 7 días · Memoria de decisiones/Value Ledger (incluye descartadas y errores) · diales de autonomía por dominio (Pagos NUNCA sube de "proponer") · push móvil con aprobación.

---

## 4. Orden de implementación (resumen del plan)

**Fase 1 (solo front, ~3-4 sem-dev):** tokens+componentes base (chrome, tabla, pills, kpi, banner, toast) → arreglos de higiene → formatos → aging Cobrar → Alertas → Conexiones → Reglas en humano → jiggle-mode de widgets (drag&drop existente se conserva, oculto tras "Personalizar").
**Fase 2 (front + API liviana, ~6-9 + 3-4 sem-dev):** V01 (flag off) → V02–V05 → V07 bandeja → V08 Gestión unificada → V06 Impuestos → V09, V12, V15, V16. En paralelo backend: unificación de definiciones de cifras (CRÍTICO — un endpoint por concepto), drill-down monto→documentos, bulk+group-by, reversiones, corte-al-día del comparativo.
**Fase 3 (con motor 1.2):** V01 decisiones reales, V13, V14, capa Piloto completa.

**Preguntas abiertas para el CTO (afectan estimación):** ¿el matcher de conciliación persiste sus features (RUT/monto/fecha del match)? ¿existen endpoints de reversión para clasificar/conciliar? ¿hay progreso consultable del sync bancario?

---

## 5. Criterios de aceptación globales (QA del rediseño)

1. Un mismo concepto financiero muestra el mismo número en todas las vistas (test: saldo caja en V01=V02=V03).
2. Cero scroll horizontal de página en ≥360px; dato primario nunca truncado.
3. Máximo un elemento rojo por pantalla; existe pantalla sin ningún rojo.
4. Todo estado vacío/carga tiene texto + acción; grep de "Cargando..." sin ETA = fallo.
5. Toda tabla: ordenar, buscar (donde aplica), paginar, exportar, footer con total.
6. Bandeja: Enter resuelve el caso con sugerencia; botón primario jamás disabled sin feedback al click.
7. Navegación resetea scroll a top; un solo ítem de nav activo.
8. Fechas y montos pasan lint de formato único.
9. Accesibilidad: foco visible en todo interactivo, contraste AA en ambos temas de pills, `prefers-reduced-motion` respetado.
10. Los textos legales/fijos de las Leyes (impuestos/sueldos/asistente solo-lee) presentes literalmente donde la spec los indica.
