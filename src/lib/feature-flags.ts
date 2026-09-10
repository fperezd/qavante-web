/* Feature flags — gating de pantallas del Addendum Frontend v2.0.
 *
 * Materializa el PATRÓN definido en ADR-0008 con la actualización de
 * ADR-0012 (override en prod permitido si la env var está explícitamente
 * seteada en Cloudflare Workers):
 *
 *   1. Override explícito: env `NEXT_PUBLIC_FF_<FLAG>` = "true"|"false".
 *      Aplica en TODOS los ambientes, incluido prod, si la env var está
 *      explícitamente seteada (ADR-0012). Sin env var → no aplica, cae
 *      al siguiente nivel. Defense: setear var en prod requiere acción
 *      manual en Cloudflare + re-deploy (Next.js inlinea NEXT_PUBLIC_*
 *      en build time) — no hay "accidente silencioso".
 *   2. Config inyectada: el resultado de `GET /api/management/config` cuando el
 *      backend lo exponga (hoy AUSENTE — verificado 2026-05-23, reconciliation
 *      P4-1). Se pasa por `opts.config`; lo cablea el PR de integración real.
 *   3. Default seguro: `false`. Flag false ⇒ la ruta existe pero renderiza un
 *      estado "todavía no disponible" — nunca UI mock, nunca ruta rota.
 *
 * El "fallback por presencia en el OpenAPI generado" del ADR-0008 NO se
 * implementa como introspección en runtime: `src/lib/api/types.ts` son tipos
 * (se borran al compilar) — no hay artefacto runtime que inspeccionar. Se
 * realizará cuando exista `/api/management/config` o cuando `generate:api`
 * emita además una lista de paths runtime. Hasta entonces el default `false`
 * es el comportamiento correcto y seguro. `FLAG_GATING_ENDPOINT` deja
 * documentado qué endpoint gobierna cada flag para ese trabajo futuro.
 */

export const FEATURE_FLAGS = [
  "managementAccounts",
  "managementDimensions",
  "industryTemplates",
  "multiCurrency",
  "classificationRules",
  "bankMovementClassification",
  "phase2PlanningPreview",
  "siiQueries",
  "cashFlowReport",
  "inicioMvp",
  "miCuenta",
  "operationalResult",
  "accountsReceivable",
  "accountsPayable",
  "dashboardSummary",
  "financialDecisionHome",
  "inicioEjecutivoV2",
  "pulsoDetail",
  "assistant",
  "onboarding",
  "obligations",
  "syncStatus",
  "remuneraciones",
  "bankBalances",
  "saludScreen",
  "libroVentasV2",
  "libroComprasV2",
  "cajaV2",
  "cajaV3",
  "pagarV2",
  "cobrarV2",
  "reconciliationReview",
  "bancoScreen",
  "payrollReconcileBoard",
  "bancoConciliacion",
  "pulsoObjetivo",
  "comportamientoPago",
  "inicioWidgets",
  "inicioAgenda",
  "gestionDashboard",
  "cajaDashboard",
  "presupuesto",
  "mcp",
  "cajaMarkCollected",
  "onboardingBanner",
  "hoyV01",
  "cajaV02",
  "bancoV03",
  "pagarV05",
  "bandejaV07",
  "cobrarV04",
  "gestionV08",
  "administracionV12",
  "remuneracionesV16",
  "onboardingV15",
  "presupuestoV09",
  "impuestosV06",
  "financiamientoV13",
  "simuladorV14",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/* Endpoint del OpenAPI que justifica habilitar cada flag (ADR-0008 §2.2 +
 * addendum §13 Tabla 8). Hoy es documentación + dato para el fallback futuro;
 * NO habilita nada por sí mismo (el default sigue siendo `false`). */
export const FLAG_GATING_ENDPOINT: Record<FeatureFlag, string> = {
  managementAccounts: "/api/management/accounts/tree",
  managementDimensions: "/api/management/dimensions",
  industryTemplates: "/api/management/industry-templates",
  multiCurrency: "/api/core/currencies",
  classificationRules: "/api/treasury/classification-rules",
  bankMovementClassification: "/api/bank-movements/{movement_id}/classify",
  phase2PlanningPreview: "/api/management/financial-versions",
  siiQueries: "/api/sii/health",
  cashFlowReport: "/api/treasury/reports/cash-flow",
  inicioMvp: "/api/me",
  /* Mi cuenta también lee /api/me, pero su capacidad propia (y única
     respecto de inicio) es cerrar sesión — ese es el endpoint que justifica
     habilitar el flag y lo mantiene 1-a-1 en el mapping. */
  miCuenta: "/api/auth/logout",
  /* Resultado Operacional de Gestión (Sprint C5). Endpoint VIVO en prod (acepta cookie, sondeado
     2026-07-17). El flag está ON; el dato de fondo aún excluye remuneraciones (gap CC-API, A1). */
  operationalResult: "/api/management/operational-result",
  /* Cobrar — cuentas por cobrar (Sprint C4). Endpoint VIVO en prod (acepta cookie). Flag ON. */
  accountsReceivable: "/api/treasury/accounts-receivable",
  /* Pagar — cuentas por pagar (Sprint C4). Endpoint VIVO en prod (acepta cookie). Flag ON. */
  accountsPayable: "/api/treasury/accounts-payable",
  /* Inicio Ejecutivo (Sprint C8) — el dashboard agregado. Endpoint VIVO en prod (acepta cookie). */
  dashboardSummary: "/api/dashboard/summary",
  /* Financial Position & Decision Engine — read-only Home card. It stays OFF until the
     deployed contract and its tenant data are validated; the frontend never derives a decision. */
  financialDecisionHome: "/api/treasury/financial-position",
  /* Inicio Ejecutivo v2 (rediseño aprobado 2026-07-12) — consume la misma fuente base
     (`/api/dashboard/summary`) que dashboardSummary; su endpoint de gating `collection-forecast`
     también está VIVO (acepta cookie, sondeado). Sigue OFF por otra razón: los campos que lo
     DISTINGUEN (key_obligations/cash_sparkline/cash_delta_pct) NO existen en el schema (gap CC-API,
     B2) → hoy el v2 se vería igual al v1. Encender recién cuando esos campos lleguen. */
  inicioEjecutivoV2: "/api/treasury/collection-forecast",
  /* Pulso detalle (Sprint C6/C7) — "¿por qué está así mi Pulso?". Endpoint VIVO en prod (acepta
     cookie). Flag ON. El cálculo del score es del backend; el FE solo muestra. */
  pulsoDetail: "/api/management/pulso",
  /* Asistente Qavante (Sprint C9, Anexo G) — chat read-only. Endpoint FE-first
     esperado (aún no existe — wire format en ADR-0004). */
  assistant: "/api/assistant/chat",
  /* Onboarding wizard (signup → verificar → SII → banco → rubro → saldo apertura
     → traer datos → dashboard). Modelo ADR-0017 (1ra persona crea empresa owner).
     Todos los endpoints vivos en prod (qavante-api #344/#345/#346 + signup/verify). */
  onboarding: "/api/auth/signup",
  /* Obligaciones / Préstamos (Tesorería → Pagar). Alta de préstamo con
     amortización francesa + conciliación de cuotas vs débitos bancarios.
     Endpoints vivos en prod y aceptan cookie (verificado 2026-06-25). */
  obligations: "/api/treasury/obligations",
  /* Indicador de sincronización (header): estado por fuente + última
     actualización + errores. FE-first contra `/api/sources/status` — el endpoint
     existe pero es api-key-only (no acepta cookie); activar cuando CC-API lo
     migre a require_session. Ver STATE_OF_THE_TRAIN (gaps de auth). */
  syncStatus: "/api/sources/status",
  /* Remuneraciones (RRHH / planilla) — dotación + totales de planilla desde BUK.
     `/api/buk/employees` acepta cookie de sesión — sondeado contra prod el 16-07-2026 (devuelve
     `no_session`, no "Falta X-Api-Key."). El flag ya está ON. La duda del comentario viejo
     ("podría ser api-key-only") quedó saldada. */
  remuneraciones: "/api/buk/employees",
  /* Saldos de las cuentas de banco (Caja): saldo contable + disponible por cuenta (CLP/USD) + la LÍNEA
     DE CRÉDITO (cupo/usado/disponible + venc. sobregiro, del balance por cuenta). `/api/bice/*` YA acepta
     cookie (CC-API lo migró a require_session — sondeado 2026-08-03: `no_session`), así que el flag ya
     puede encenderse en prod (editar wrangler.toml). Ver STATE_OF_THE_TRAIN. */
  bankBalances: "/api/bice/saldo",
  /* Pantalla Salud (PULSO + Health Score, ADR-0064). FE-first: la vista
     (`SaludView`) ya existe (prototipo, PR #476, hoy solo en Storybook); la ruta
     renderiza SIEMPRE "En construcción" — sin datos de ejemplo en ningún
     ambiente (qavante-api#936, regla dato faltante ≠ dato demo) — hasta que
     CC-API exponga el motor v2 (qavante-api #492 PULSO / #495 QHS / #493 flip).
     El cableado a datos reales + tipos generados (qavante-web #487) reintroduce
     la vista gateada por este flag. */
  saludScreen: "/api/management/salud",
  /* Libro de Ventas v2 (rediseño aprobado 2026-07-13) — reordena la pantalla a la
     jerarquía del Inicio (respuesta de dueño arriba + tabla que sube + concentración
     lateral). Lo que lo enciende del todo son los comparativos del ritmo, que se
     piden como endpoint FE-first (aún no existe — ver libro-comparativos-contract).
     Con el flag OFF: el libro clásico intacto; sin el endpoint, los comparativos
     degradan (se omiten) y el hero muestra neto + sparkline del rango. */
  libroVentasV2: "/api/sii/rcv/ventas/comparativos",
  /* Libro de Compras v2 (mismo rediseño, análogo a Ventas) en `/pagar/facturas-
     recibidas`. Su endpoint de comparativos es el de compras. Flag independiente para
     poder encender Ventas y Compras por separado. */
  libroComprasV2: "/api/sii/rcv/compras/comparativos",
  /* Caja v2 (rediseño aprobado 2026-07-14) — Resumen con la curva de saldo que cae y toca
     el piso. Lo que lo distingue es la caja mínima (la línea del piso), su endpoint de
     gating. Reusa el reporte de caja (cashFlowReport) para los netos; con OFF, el reporte
     clásico queda intacto. La curva se deriva (saldo + netos) hasta que CC-API mande
     running_balance/min_cash. */
  cajaV2: "/api/treasury/cash-minimum",
  /* Caja v3 (rediseño visual 2026-07-20) — reemplaza la curva de "Saldo proyectado" (una recta
     sobre el cash-flow histórico, que no proyecta el futuro) por un MEDIDOR de días de caja +
     CASCADA de próximos movimientos, ambos derivados de los VENCIMIENTOS (cobranzas del maestro AR
     + obligaciones del maestro AP + payroll/tax/rent/debt/leasing de accounts-payable). Su endpoint
     de gating es la proyección de caja forward (FE-first, aún no existe — hoy el FE la deriva de los
     vencimientos, mismo motor que Cobrar/Pagar). Con ON reemplaza la curva del Resumen; hoy OFF, la
     curva clásica queda intacta. Estado honesto si no hay proyección forward. */
  cajaV3: "/api/treasury/cash-projection",
  /* Pagar v2 (rediseño aprobado 2026-07-14) — respuesta de dueño (cuánto debe pagar +
     ¿la caja alcanza?) + brecha de caja + las 3 del mes + vencimientos con postergabilidad
     + mayores compromisos. Reusa `accounts-payable` (accountsPayable) para los datos; lo que
     lo DISTINGUE y lo enciende del todo es la postergabilidad por ítem (hoy HEURÍSTICA en el
     FE) y el plan de pago — ese es su endpoint de gating (FE-first, aún no existe). Con el
     flag ON tiene prioridad sobre accountsPayable (mismo dato base); hoy OFF, el Pagar
     clásico queda intacto. */
  pagarV2: "/api/treasury/payment-plan",
  /* Cobrar v2 (rediseño 2026-07-19) — respuesta de dueño: "a quién le cobras primero" + acciones
     reales de cobranza (copiar recordatorio en chileno, WhatsApp/mail, marcar gestionado persistido
     en prefs). Reusa `accounts-receivable` (accountsReceivable) para los datos; degrada honesto en
     dos modos según haya o no vencimientos del SII (urgencia vs. concentración). Lo que lo ENCIENDE
     del todo es el plan de cobranza por vencimiento (FE-first, aún no existe) — ese es su endpoint de
     gating, el que lo pasa de "concentración" a "urgencia". Con ON tiene prioridad sobre la vista
     clásica de Cobrar; hoy OFF, el Cobrar clásico queda intacto. */
  cobrarV2: "/api/treasury/collection-plan",
  /* Cola de conciliación (ADR-0036/0042) — el motor auto-aplica los matches con score >=90 y deja
     los 60-90 en una cola de revisión de 1 clic (confirmar/rechazar/conciliar todas). La pantalla
     nueva la consume; su endpoint de gating es la cola misma. LIVE en prod desde 2026-07-17
     (`NEXT_PUBLIC_FF_RECONCILIATION_REVIEW="true"` en wrangler.toml). */
  reconciliationReview: "/api/treasury/reconciliation/review",
  /* Pantalla Banco (2026-08-04) — los PRODUCTOS del tenant por banco: cuentas corrientes (saldo + línea
     de crédito) + tarjetas de crédito (cupo). Consume `/api/bice/*` (ya cookie-open). Gated OFF hasta
     validar la UX con Fernando; encender = editar wrangler.toml. */
  bancoScreen: "/api/bice/tarjetas",
  /* Conciliación de sueldos ACCIONABLE en Remuneraciones (#835) — el board del backend
     (`/api/admin/treasury/payroll-settlements/{period}`) es la fuente de verdad; deja conciliar
     una-a-una / varias marcadas y DESASIGNAR (revert). Los 3 endpoints (settlements/reconcile/revert)
     están deployados (2026-08-04, qavante-api #826/#827). Gated OFF hasta que Fernando valide al peso
     con su sesión que el shape del board/reconcile (objetos genéricos en el OpenAPI) calza con lo que
     el FE normaliza; encender = editar wrangler.toml. Con OFF, la Conciliación pasiva por-monto queda
     intacta (cero regresión). */
  payrollReconcileBoard: "/api/admin/treasury/payroll-settlements/{period}",
  /* Conciliación POR movimiento en el detalle de una cuenta de Banco (Fase 2, 2026-08-06) — cada
     movimiento "Por conciliar" con match propuesto (de la cola `reconciliation/review`, cruzada por
     movement_id con la cuenta) ofrece "Conciliar" / "Rechazar" + un tab "Sugerencias". Muta (confirm),
     así que gated OFF hasta validar al peso el path confirm con la sesión de Fernando (bug histórico
     `confirm_review`). Con OFF, el detalle queda read-only (Fase 1, cero regresión). Su endpoint de
     gating es el confirm POR movimiento (lo que lo distingue de `reconciliationReview`, que solo lee la
     cola). Encender = editar wrangler.toml. */
  bancoConciliacion: "/api/treasury/reconciliation/{movement_id}/confirm",
  /* Pulso configurable por OBJETIVO (2026-08-06) — el dueño elige qué prioriza la empresa (cuidar la
     caja / cumplir pagos / crecer / equilibrado) y eso re-pondera los ejes del Pulso. El FE captura el
     objetivo (persistido en prefs) y lo manda como `?objetivo=` a `/api/management/pulso`; el
     re-ponderado del score lo hace CC-API (el FE no calcula Pulso). Gating endpoint = ese param.
     OFF hasta que el backend honre el parámetro (hoy lo ignora → devuelve el equilibrado, sin número
     falso). Con OFF, el Pulso detalle queda como está (cero regresión). Encender = editar wrangler. */
  pulsoObjetivo: "/api/management/pulso?objetivo=",
  /* Comportamiento de pago (2026-08-06) — insight en Ciclo de caja: complementa el DSO con el desfase
     REAL vs vencimiento (`behavior_shift_days` de `/api/treasury/collection-projection`, agregado de
     cobros). Primer paso hacia la "temporalidad" que pidió Fernando; el detalle POR CONTRAPARTE es
     brecha de CC-API (qavante-api #858). OFF hasta validar el dato al peso; con OFF Ciclo de caja queda
     igual (cero regresión). Encender = editar wrangler. */
  comportamientoPago: "/api/treasury/collection-projection",
  /* Personalizar el Inicio (2026-08-08) — el dueño PRENDE/APAGA las tarjetas (mover ya lo hace el
     DraggableCard). Fundación del norte "la mañana del dueño": mover + on/off + catálogo. Persiste en
     el blob de prefs (clave `inicio_widget_hidden`, molde `widget-order`). Gating endpoint = las prefs
     que lo persisten. OFF hasta validar; con OFF el Inicio v2 queda igual (cero regresión). Requiere
     `inicioEjecutivoV2` ON para verse (el v2 gatea la pantalla). Encender = editar wrangler. */
  inicioWidgets: "/api/me/preferences",
  /* Agenda de las próximas 2 semanas en el Inicio (2026-08-08) — tarjeta que compone los vencimientos
     forward (cobros del maestro AR + pagos AP + F29/Previred/sueldos/arriendo) a 14 días, agrupados por
     semana. Reusa el motor de la cascada de Caja. Requiere `inicioEjecutivoV2` ON para verse; se puede
     mover/apagar como cualquier widget (framework `inicioWidgets`). OFF hasta validar; con OFF el Inicio
     queda igual (cero regresión). Encender = editar wrangler. */
  inicioAgenda: "/api/sii/rcv/ventas",
  /* Gestión como tablero REORDENABLE (2026-08-08, piloto de "reordenar cards en otras pantallas"): las
     secciones de la vista v2 (resultado/hero, márgenes, comparativos, cascada, drivers, tendencia, pulso,
     confianza) se muestran como cards movibles/apagables (mismo motor iPad del Inicio) con orden/visibilidad
     por `gestion_widget_*` en prefs. OFF hasta que Fernando lo valide; con OFF la Gestión queda IGUAL (el
     informe/matriz de siempre) → cero regresión. Encender = editar wrangler. */
  gestionDashboard: "/api/management/operational-result/breakdown",
  /* Caja como landing REORDENABLE (2026-08-08, piloto): las secciones de la landing (resumen/medidor,
     saldos en banco, movimientos, proyectada) como bloques movibles/apagables (motor iPad del Inicio),
     orden/visibilidad por `caja_widget_*`. OFF hasta validar; con OFF la Caja queda IGUAL → cero
     regresión. Encender = editar wrangler. */
  cajaDashboard: "/api/bice/cuentas",
  /* Pantalla Presupuesto propositivo (ADR-0091, 2026-08-09): "cómo vas" contra el plan que Qavante
     PROPONE desde el histórico (POST budget/propose) + ajuste "+% ventas". Consume budget-vs-actual.
     Requiere el backend #870 (ya en main). Encender = editar wrangler. */
  presupuesto: "/api/planning/budget-vs-actual",
  /* Administración → MCP (ADR-0092): conectar la empresa a un asistente LLM (ChatGPT/Claude) vía el
     server MCP de Qavante. Gestiona las API-keys de la empresa (crear/listar/revocar). Requiere el
     backend #882/#888 (ya en main). Gated OFF hasta que Fernando lo valide. */
  mcp: "/api/mcp/connection",
  /* Conciliar cobros FILA-POR-FILA desde el caveat de por-cobrar-vencido de Caja (#851): "Ya lo cobré"
     marca el documento como conciliado (POST reconciliation/mark-collected, reversible). Hoy conciliar
     desde Caja obliga a saltar a otra pantalla. Gated OFF hasta que Fernando valide el write al peso
     (no puedo POSTear a prod); con OFF el caveat queda igual (solo el link "Conciliar cobros →") → cero
     regresión. Encender = editar wrangler. */
  cajaMarkCollected: "/api/treasury/reconciliation/mark-collected",
  /* Banner "te falta conectar" del wizard, montado en el layout de (app). Se separó del flag
     `onboarding` a propósito (review del PR #935): el wizard alcanza SOLO a quien se registra, pero
     este aviso alcanza a TODOS los tenants existentes (el backfill los dejó `completed = true`) y en
     todas las pantallas. OFF hasta que Fernando lo valide; con OFF el hub de conexiones sigue
     accesible desde el propio wizard, así que no se pierde la salida. Su endpoint de gating es el
     status del onboarding: de ahí sale `completed` y qué fuentes quedaron pendientes, o sea lo que
     hace existir al banner. Para NO confundir `missing` con `stale`/`error` cruza además el estado
     canónico `/api/sources/status`, que ya es el endpoint de gating de `syncStatus` y por eso no se
     repite acá (el mapa es 1-a-1, invariante cubierta por `feature-flags.test.ts`). */
  onboardingBanner: "/api/onboarding/status",
  /* V01 · Hoy — la portada del rediseño (ESPECIFICACION §V01, issue #62). Es la ruta `/` reescrita
     alrededor de UNA pregunta ("¿cómo está mi empresa y qué necesita mi OK?"): crumb con frescura
     del banco, titular-veredicto, "Esperando tu visto bueno" y strip de 4 indicadores. Consume
     `/api/dashboard/summary`, que ya está VIVO — o sea que la vista funciona hoy, y por eso la
     aceptación del issue pide justamente que ande con el flag apagado.

     Su endpoint de gating es la BITÁCORA, y no el summary: `/api/reversible-actions` publica
     sólo automatismos REVERSIBLES de Qavante con estado real de Deshacer (ADR-0113). #65 monta
     ese subconjunto de manera explícita, pero NO lo vende como la actividad integral de la spec:
     sync, clics manuales y automatismos sin reader siguen fuera. Con OFF, el Inicio actual queda
     intacto → cero regresión. */
  hoyV01: "/api/reversible-actions",
  /* V02 · Caja — "¿me alcanza la caja?" (ESPECIFICACION §V02, issue #67). Reemplaza la landing de
     `/caja` por la tríada KPI (Hoy vía `cajaHoy()`, Entra 14d, Sale 14d con postergable), el banner
     de deuda de datos, las barras de 4 semanas, la tabla "Qué te lleva al punto más bajo" y el
     footer de exclusiones. Todo sobre endpoints VIVOS (summary, cash-projection,
     collection-forecast, accounts-payable) — la vista funciona hoy.

     Su endpoint de gating es lo ÚNICO que le falta: "Postergar ▾ (7/15/30 días)" necesita que
     exista cómo mover la fecha estimada de un pago que la proyección lea, y hoy no existe
     (`accounts-payable` es GET-only; los términos de pago del front viven en preferencias que
     `cash-projection` no consulta). Es FE-first, como el de `hoyV01`, con su issue sucesor (#80).
     Con OFF, la Caja actual queda intacta → cero regresión. */
  cajaV02: "/api/treasury/accounts-payable/{payable_id}/estimated-date",
  /* V03 · Banco — "tus cuentas y tarjetas, con su estado, y cada movimiento con su ciclo de vida"
     (ESPECIFICACION §V03, issue #68). Reemplaza la pantalla de `/banco` por: "Caja hoy" vía
     `cajaHoy()` (Ley 1, la misma función que V01/V02), la tabla de cuentas con frescura + pill de
     conexión + saldo según el banco, el banner "conectar otro banco", los filtros con conteo y la
     tabla de movimientos con pill {Conciliado ✓ / Clasificado ✓ / Por clasificar → Clasificar}. Todo
     sobre endpoints VIVOS (summary, bice/*, bank-accounts, sources/status, bank-movements).

     El contrato vivo `/api/sources/status` ahora publica `sync_progress` por fuente: `started_at`
     siempre que el sync siga vigente, y `eta_seconds`/`step` sólo cuando la integración los sabe.
     La vista nunca calcula una ETA: muestra la recibida o el tiempo transcurrido y declara que falta.
     `FLAG_GATING_FIELD` declara el campo que distingue este consumidor del indicador global de
     sincronización, sin inventar rutas ni query params. Con OFF, la pantalla Banco actual (`bancoScreen`)
     queda intacta → cero regresión. */
  bancoV03: "/api/sources/status",
  /* V05 · Pagar — "¿a quién le pago, y qué es crítico?" (ESPECIFICACION §V05, issue #70).
     Reemplaza la landing de `/pagar` por: la tríada (Vencido / Por pagar con selector 7-14-30 /
     Crítico vs. caja), el banner de postergables que enlaza a Hoy (la ejecución masiva NO vive
     acá), los filtros con conteo (Impuestos y Remuneraciones incluidos) y la tabla con proveedor
     completo, vence absoluto+relativo, pill de tipo y "detalle ▾". Todo sobre
     `accounts-payable` (VIVO; la misma fuente que "Sale · 14 días" en V02 → Ley 1) — la vista
     funciona hoy, nómina de ADR-0056 incluida.

     Su endpoint de gating es lo ÚNICO que le falta: la detección de anomalías (posible duplicado)
     hecha por el BACKEND. La spec la marca 🔧 ("regla simple en front, o API liviana si el volumen
     lo exige") y hoy la regla —mismo RUT + monto ±1 % + 30 días— corre en el front sobre los
     ítems listados, que el endpoint TOPEA en 100: un duplicado fuera de esa ventana es invisible
     desde acá, así que la versión completa es del backend. Es FE-first, como los de
     `hoyV01`/`cajaV02`/`bancoV03`, con su issue sucesor. Con OFF, el Pagar actual (clásico o
     `pagarV2`) queda intacto → cero regresión. */
  pagarV05: "/api/treasury/accounts-payable/anomalies",
  /* V07 · Bandeja de excepciones — "sólo lo que el piloto no resolvió solo" (ESPECIFICACION §V07,
     issue #71). RUTA NUEVA (`/bandeja`): una card a la vez, con auto-avance, sobre dos fuentes ya
     VIVAS — la cola de conciliación (`reconciliation/review` + `document-suggestions` para la
     evidencia de los dos lados) y los movimientos sin clasificar (`bank-movements` +
     `suggested-category`, que devuelve `null` cuando ninguna regla matchea).

     El hueco de Ley 5 que dejaba esta vista sin encender —la REVERSIÓN de una clasificación— se
     cerró en issue #90: `qavante-api#257` (ADR-0113, patrón genérico de reversión) mergeó
     2026-08-31 y la carta de clasificar ya consume `GET /api/reversible-actions` +
     `POST /api/reversible-actions/{action_id}/revert` para lo que Qavante clasificó SOLO por
     regla o por conciliación (`apply-rules` / `classify-reconciled`); deshacerlo devuelve el
     movimiento a "sin clasificar". Conciliar sigue con la suya propia, deployada antes
     (`.../reconciliation/{movement_id}/revert`).

     El flag SIGUE apagado — no por esto, que ya está resuelto, sino por lo que el propio issue
     #90 declara que #90 NO cierra: clasificar un lote de una sola vez a una categoría elegida (no
     existe el endpoint), registrar el par negativo de "no es esta", y que el progreso cuente
     "hoy" y no sólo "esta sesión" (no hay bitácora consultable para eso). Los otros gatings
     FE-first de este archivo (`sync-progress`, `estimated-date`, `anomalies`) son la misma forma:
     un flag no se enciende hasta que TODOS sus huecos declarados se cierran, no sólo el primero.
     Con OFF, `/bandeja` renderiza el estado "todavía no disponible" con salida a los dos flujos
     que hacen este trabajo hoy (`/caja/conciliacion` y `/caja/por-clasificar`), que es lo que
     ADR-0008 fija más arriba en este mismo archivo. Ninguna pantalla existente cambia → cero
     regresión. */
  bandejaV07: "/api/reversible-actions/{action_id}/revert",
  /* V04 · Cobrar — "¿quién me debe?" (ESPECIFICACION §V04, issue #69). Reemplaza la landing de
     `/cobrar` por: crumb con el estado de gestión como chip gris, las 5 tarjetas de aging
     (Vigente / 1–30 / 31–60 / +61 / Vencido · bruto ⓘ) con % del total, el banner de concentración
     ("3 clientes concentran $X del vencido" → "Enviar a los 3"), los filtros con conteo y la tabla
     de clientes con WhatsApp · correo · Recordatorio (las plantillas actuales de Cobrar v2). Todo
     sobre `accounts-receivable` (VIVO; la misma función del backend que alimenta "Te deben" en
     V01 → Ley 1) y las prefs de gestión — la vista funciona hoy, con `overdue: null` incluido.

     Su endpoint de gating es el envío EN LOTE de recordatorios a terceros. Después de la ventana
     cancelable de Ley 4, el front manda exclusivamente UUIDs trazables del summary junto a una
     llave idempotente; el servidor conserva el ledger y devuelve el resultado por documento.
     `sin_destinatario`, `skipped` y `error` se muestran como tales, nunca como éxito. Con OFF, el
     Cobrar actual (v2 en producción) queda intacto → cero regresión. */
  cobrarV04: "/api/treasury/collection-reminders/send",
  /* V08 · Gestión — "¿gano o pierdo?" en SEIS tabs (ESPECIFICACION §V08, issue #72). Unifica las
     nueve páginas de `/gestion` en una vista con tabs Resultado / Márgenes / Tendencia /
     Comparativo / Clientes 360 / Proveedores 360; Costos y gastos entra como sección del Resultado
     y Ciclo de caja + Punto de equilibrio como bloques de Márgenes (HTML 08·C/08·D). Con el flag
     ENCENDIDO, las ocho sub-rutas viejas redirigen a su tab equivalente (`destinoRutaVieja`); con
     OFF quedan exactamente como están → cero regresión.

     Las tres fuentes que el issue daba por faltantes existen y la vista las usa: el drill-down
     monto→documentos (`/operational-result/documents`) y el corte al día del comparativo
     (`/operational-result/al-dia`) y el export nativo CSV del mismo pivote. Se anuncia CSV, no XLS.

     Su endpoint de gating ya existe. Encender = editar wrangler.toml. */
  gestionV08: "/api/management/operational-result/export",
  /* V12 · Administración — el hub como tabla de 8 entradas con estado por fila (ESPECIFICACION
     §V12, issue #75). Reemplaza la grilla de tarjetas de `/administracion` por una tabla; la fila
     Credenciales reusa la MISMA fuente que V11 (`sourceToConnectionCopy` sobre
     `/api/sources/status`, ya VIVO) para "N requiere(n) tu acción → Renovar" (Ley 1). Empresas y
     Usuarios también van sobre endpoints VIVOS (`/api/me/tenants`, `/api/users`) — la vista
     funciona hoy.

     El contrato de API #441 publica origen y uso verificable desde el inicio de medición. Las
     fuentes no instrumentadas conservan cobertura desconocida y la UI dice "Uso sin dato";
     nunca las convierte en cero. Con OFF, `/administracion` vuelve a la grilla de tarjetas
     anterior. */
  administracionV12: "/api/treasury/classification-rules/{rule_id}/usage",
  /* V16 · Remuneraciones — "Tu nómina" en una pantalla (ESPECIFICACION §V16, issue #77).
     Reemplaza la landing de `/remuneraciones` por la tríada (Líquido / Cotizaciones (Previred) /
     Costo empresa con % de ingresos ⓘ) y la tabla por persona con estado + link a su liquidación.
     Todo sobre endpoints VIVOS: `/api/buk/payroll` (líquido, cotizaciones — el flag `remuneraciones`
     ya está ON), `/api/buk/payroll/detail` (costo empresa por persona, ADR-0057), `/api/bank-movements`
     (estado Pagado/Pendiente) y `/api/management/operational-result` (ingresos del período, el
     flag `operationalResult` ya está ON) — la vista funciona hoy.

     TRAMPA de doble conteo (ADR-0056 nómina=payable real en Pagar; ADR-0070 el monto sale de BUK):
     "Costo empresa" NO se calcula como líquido + cotizaciones (eso duplicaría la porción que el
     trabajador ya se descontó de su bruto) — se REUSA el `costo_empresa` que BUK entrega por
     persona en `/api/buk/payroll/detail`, la misma fuente que ya muestra la Planilla clásica. Ver
     `remuneraciones-v16-model.ts` (cabecera) y su test `costo empresa no duplica cotizaciones`.

     Su endpoint de gating es lo ÚNICO que le falta a la vista: un documento de liquidación POR
     PERSONA. BUK no lo expone (verificado contra `src/lib/api/types.ts` — sin `settlement_url` ni
     campo equivalente en `EmployeeDetailResponse`), así que "liquidación" en cada fila enlaza,
     mientras tanto, al MISMO destino que ya usa Pagar V05 para la fila "Remuneraciones" (`hrefDe`
     de `pagar-v05-model.ts`): la Planilla del período en la vista clásica. Es FE-first, como los de
     `hoyV01`/`cajaV02`/`bancoV03`/`pagarV05`/`bandejaV07`/`gestionV08`, con issue sucesor. El path
     de abajo es la FORMA esperada de ese documento futuro, no una cita de un endpoint que exista
     hoy. Con OFF, `/remuneraciones` queda exactamente como está (las pestañas Dotación / Planilla /
     Clasificación / Conciliación) → cero regresión. Encender = editar wrangler.toml. */
  remuneracionesV16: "/api/buk/employees/{employee_id}/settlement",
  /* V15 · Onboarding — `/bienvenida` (ESPECIFICACION §V15, issue #76, R1). RUTA NUEVA (no existía).
     Tres pasos en una vista: (1) fuentes con estado y tiempo estimado por conexión — orquesta el
     MISMO adaptador que el hub `/conexiones` y el guard del onboarding (`useOnboardingSources`
     sobre `/api/onboarding/status`, VIVO), Ley 1; (2) inicia y consulta el run estable de
     `/api/onboarding/sync-runs`; y (3) deja claro que el primer parte queda disponible al terminar.
     El contrato #351 publica por fuente `status`, `step`, `records_read` y `eta_seconds`: null se
     declara como ausencia, nunca se sustituye por cero o una estimación local. No promete fecha u
     hora porque el backend no publica scheduler ni calendario. Con OFF, `/bienvenida` renderiza el
     estado "todavía no disponible" (ADR-0008) — ninguna pantalla existente cambia → cero regresión.
     Encender = editar wrangler.toml. */
  onboardingV15: "/api/onboarding/sync-runs",
  /* V09 · Presupuesto — `/presupuesto` (ESPECIFICACION §V09, issue #74, R1). Reemplaza la landing
     de Presupuesto (ADR-0091 Fase 1a, flag `presupuesto`) por la tríada Plan/Real/Desvío + la
     tabla de desvíos por concepto, ambas sobre `GET /api/planning/budget-vs-actual` — endpoint
     VIVO en prod (verificado contra el tenant productivo 2026-08-31, issue #74 comentario): trae
     `has_budget`, `data_state`, `missing_sources` y las 4 líneas con `variance`/`variance_pct` YA
     CALCULADOS (el front NO los recalcula — Ley 1). INV-FIN-001 se cumple al peso: el `actual` de
     la línea `revenue` es exactamente el `revenue` de `GET /api/management/operational-result` del
     mismo período (el "Real" de acá = el "Resultado" de V08).

     Alcance RECORTADO a propósito (issue #74): NO incluye el link a los documentos que explican
     cada desvío (drill-down monto→documentos) ni el banner de proyección de cierre ("a este
     ritmo…"). El primero es un fork de diseño del BO (ADR-0091 F1b) — "no se decide sin
     Fernando"; el segundo depende de la MISMA decisión de forma. El endpoint que alimentaría el
     drill-down (`/operational-result/documents`) YA EXISTE y V08 ya lo usa: el bloqueo es de
     FORMA, no de dato (issue #74, comentario 2026-08-31) — por eso es justamente ESE el endpoint
     de gating: es lo único, verificado, que le falta a la vista para estar completa, igual que en
     `hoyV01`/…/`onboardingV15`. Es FE-first, con issue sucesor declarado en pantalla
     (`HuecosDeclarados` de `presupuesto-v09-view.tsx`).

     Con OFF, `/presupuesto` sigue exactamente como hoy: la pantalla de ADR-0091 Fase 1a detrás del
     flag `presupuesto` (que sigue ON en prod) → cero regresión. Encender = editar wrangler.toml. */
  presupuestoV09: "/api/management/operational-result/documents",
  /* V06 · Impuestos — `/impuestos` (ESPECIFICACION §V06, issue #73, R2). RUTA NUEVA (no existía).
     Tríada (Próximo vencimiento / F-29 del mes en curso / Deudas TGR) + calendario tributario
     (F-29 declarado o no, IVA postergado del SII, Previred, TGR) sobre TRES fuentes YA vivas:
     `/api/sii/f29/estado?anio=` (la MISMA que ya consume el panel de `/pagar/impuestos/f29`),
     `/api/buk/payroll` (la MISMA que `previred-view.tsx` y V16 — Ley 1) y `/api/tgr/health` +
     `/movimientos-deudas` (la MISMA que `/pagar/impuestos/tgr`; si `authenticated` es `false`,
     la vista degrada como esa pantalla, nunca inventa una deuda).
     La vista funciona hoy con datos reales.

     `GET /api/treasury/tax-calendar` EXISTE pero verificado VACÍO en producción (issue #73,
     comentario 2026-08-31: `total: "0"`, `events: []`) y `GET /api/treasury/obligations` sólo
     trae `card_purchase` — ninguno de los dos alimenta esta vista.

     El endpoint de gating ya existe: `/api/sii/f29/impuesto` publica `estimable`, `missing_inputs`,
     `as_of` e `input_sources` (qavante-api #401). La vista no recalcula el impuesto y muestra el
     monto sólo con `estimable=true`; ausencia e inconsistencia quedan como "sin dato". El campo
     `estimable` forma parte de la identidad de gating para no confundir el endpoint histórico con
     el contrato seguro. Queda un hueco independiente: `PayableItem` no liga un F-29 declarado a
     un movimiento bancario específico, así que "conciliado con cargo bancario" tampoco se infiere
     (declarado en pantalla, el comprobante enlaza al F-29 real del SII en su lugar).

     Con OFF, `/impuestos` renderiza el estado "todavía no disponible" con salida a
     `/pagar/impuestos` (F-29/TGR) y `/pagar/previred` — los dos flujos que hacen este trabajo hoy.
     Producción activa el override explícito en wrangler.toml; el default sigue false.
     La conciliación bancaria pendiente se sigue en tooxs-digital/qavante-api#440. */
  impuestosV06: "/api/sii/f29/impuesto",
  /* V13 · Financiamiento. Publica deuda, costo y capacidad sólo desde un read model F5
     scopeado por entidad legal, moneda funcional y corte del servidor. Las alternativas
     existentes se muestran como comparables o referencias, nunca como ofertas ejecutables.
     Default OFF hasta que qavante-api#443 esté revisado y desplegado. */
  financiamientoV13: "/api/treasury/financing-overview",
  /* V14 · Simulador. Evalúa una hipótesis contra el scope financiero canónico y
     devuelve un memo explícitamente no ejecutable. Default OFF hasta que
     qavante-api#467 integre los productores live y su smoke productivo quede aprobado. */
  simuladorV14: "/api/treasury/simulations/evaluate",
};

/** Campo de contrato que un consumidor necesita además del endpoint. La identidad de gating es
 * endpoint + campo; sólo se declara cuando compartir endpoint no implica compartir capacidad. */
export const FLAG_GATING_FIELD: Partial<Record<FeatureFlag, string>> = {
  bancoV03: "sync_progress",
  impuestosV06: "estimable",
};

export function flagGatingIdentity(flag: FeatureFlag): string {
  return `${FLAG_GATING_ENDPOINT[flag]}#${FLAG_GATING_FIELD[flag] ?? ""}`;
}

/* Shape de `GET /api/management/config` (cuando el backend lo exponga).
 * Parcial: el backend puede mandar solo los flags que conoce; los ausentes
 * caen al default. `null` = endpoint no disponible todavía. */
export type FeatureFlagConfig = Partial<Record<FeatureFlag, boolean>> | null;

export interface ResolveFeatureFlagOptions {
  /** Resultado de `GET /api/management/config`. Inyectado por el PR de
   *  integración real; hoy siempre `null`/ausente (endpoint no existe). */
  config?: FeatureFlagConfig;
  /** Inyección de entorno para tests deterministas. Default: `process.env`. */
  env?: Record<string, string | undefined>;
}

/** `managementAccounts` → `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS`. */
export function flagEnvVar(flag: FeatureFlag): string {
  const screaming = flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  return `NEXT_PUBLIC_FF_${screaming}`;
}

function readOverride(
  flag: FeatureFlag,
  env: Record<string, string | undefined>,
): boolean | undefined {
  /* ADR-0012: el override aplica en TODOS los ambientes (incluido prod)
     si la env var está explícitamente seteada. Defense: setear var en
     prod requiere acción manual en Cloudflare Workers + re-deploy
     (Next.js inlinea NEXT_PUBLIC_* en build time) — no hay accidente
     silencioso. Sin env var → cae al siguiente nivel (config / default).
     Supersede el invariante de ADR-0008 ("nunca en prod"). */
  const raw = env[flagEnvVar(flag)];
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined; // valor no reconocido → se ignora, cae al siguiente nivel
}

/** Resuelve un flag según la jerarquía de ADR-0008. Default seguro: `false`. */
export function resolveFeatureFlag(
  flag: FeatureFlag,
  opts: ResolveFeatureFlagOptions = {},
): boolean {
  const env = opts.env ?? (process.env as Record<string, string | undefined>);

  const override = readOverride(flag, env);
  if (override !== undefined) return override;

  const fromConfig = opts.config?.[flag];
  if (fromConfig !== undefined) return fromConfig;

  return false;
}

/** Resuelve los 8 flags de una. Útil para Server Components / providers. */
export function resolveFeatureFlags(
  opts: ResolveFeatureFlagOptions = {},
): Record<FeatureFlag, boolean> {
  return Object.fromEntries(FEATURE_FLAGS.map((f) => [f, resolveFeatureFlag(f, opts)])) as Record<
    FeatureFlag,
    boolean
  >;
}
