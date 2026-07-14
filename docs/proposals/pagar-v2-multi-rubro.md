# Pagar v2 — Fit multi-rubro (¿sirve para cualquier PYME?)

> **CC-WEB · 2026-07-14.** Análisis de UX/dominio del rediseño de Pagar (hero de dueño
> + "Las 3 del mes" + timeline "Por vencer y vencidos" + "Mayores compromisos" +
> brecha contra caja + postergabilidad). Pregunta de Fernando: ¿funciona para
> constructora, retail, servicios, venta al por mayor, etc.? Documento el veredicto y,
> con foco, **retail y gastronomía** (donde Fernando quiere que funcione bien).
> Es criterio de dominio, NO validación con usuarios → validar con 2-3 clientes reales.

---

## Decisión (2026-07-14, Fernando)

- **Pagar es ÚNICO para todas las industrias** — sin "modos" ni pantallas por rubro (se
  descartó el "modo caja diaria"). Los ajustes útiles (horizonte día/semana/quincena/mes,
  consolidación por proveedor, postergabilidad realista) son **mejoras del Pagar único** y
  benefician a todos los rubros.
- **El timing de la plata vive en Caja, no en Pagar.** La liquidación de tarjetas por
  acreditar y las cobranzas esperadas (entradas), y los pagos de Previred/IVA/sueldos/
  proveedores (salidas), son la **proyección de flujo de Caja**. Pagar responde "¿qué debo y
  me alcanza?" **consumiendo** la caja proyectada que Caja calcula; no re-inventa el flujo ni
  suma plata en tránsito como caja disponible (*identificada ≠ asegurada*).

## Veredicto: el núcleo es universal; 2 dimensiones se tensionan

La pregunta que resuelve Pagar —*"¿cuánto debo, cuándo, me alcanza la caja, qué puedo
postergar?"*— y **"Las 3 del mes"** (Previred · IVA/F29 · sueldos) aplican a **cualquier
PYME chilena con empleados y operación regular**. Los bloques son **agnósticos al rubro**:
lo que cambia es el *énfasis* que el propio dato les da (retail resalta proveedores;
servicios, sueldos; construcción, la obra). Mismos componentes, se adaptan al dato → no
hay que diseñar una pantalla por rubro.

| Rubro | Encaje | Por qué |
|---|---|---|
| Servicios profesionales | ✅ Excelente | Sueldos + arriendo + SaaS (USD) + honorarios (BHE). Caso más limpio. |
| Venta al por mayor / distribución | ✅ Excelente | Todo es *timing* (plazos 30/60/90); cobertura de caja y postergabilidad son el corazón. |
| Retail | ✅ Bien (con ajustes) | Concentración por proveedor + postergabilidad. **Volumen** alto de docs. |
| Gastronomía | ✅ Bien (con ajustes) | Insumos diarios + personal alto + caja diaria. **Volumen + horizonte corto**. |
| Transporte / logística | ✅ Bien | Leasing + deuda + combustible caen en las categorías. |
| Salud / clínicas | ✅ Bien | Honorarios (BHE) + cotizaciones + insumos. |
| **Construcción / ingeniería / productoras** | 🔴 **Incompleto** | Piensan por **obra/proyecto**; **estados de pago**, **retenciones**, anticipos no modelados. |
| Agrícola / turismo (estacional) | ⚠️ Parcial | Flujo por temporada; el **horizonte fijo de 14 días es corto**. |

---

## Dónde se tensiona (y cómo robustecer, sin rehacer nada)

1. **Dimensión proyecto/obra** (construcción, ingeniería, productoras, agencias por
   cliente). El modelo plano (categoría × fecha) no captura "cuánto llevo gastado en la
   Obra X vs. su presupuesto", ni **estados de pago** / **retenciones de garantía** /
   anticipos.
   → **Reusar las dimensiones de gestión (D1/D2)** que Qavante ya tiene: la obra/proyecto
   es una de esas dimensiones. Pagar debería poder **agrupar/filtrar por proyecto**. Los
   estados de pago/retenciones sí son modelo de dato nuevo (backend) — solo si se prioriza
   construcción.

2. **Horizonte configurable** (estacionales, y también retail/gastronomía). El default de
   14 días es corto para negocios semanales/diarios y para estacionales.
   → Horizonte **configurable** (semana / 14d / mes / temporada); default por rubro.

3. **Volumen** (retail, gastronomía). Cientos de documentos.
   → **Consolidar por contraparte** en el timeline + búsqueda/filtros sólidos + la
   concentración ya ayuda. Ver sección siguiente.

---

## Foco: retail y gastronomía (lo que Fernando quiere que funcione bien)

Ambos comparten: **alto volumen** de documentos chicos, **caja diaria crítica**, **medios
de pago con liquidación diferida** (Transbank T+1/T+2), **márgenes ajustados**, y el grueso
de la venta en **boletas** (no facturas). Diferencias: retail compra inventario con plazos
negociados; gastronomía compra insumos perecederos casi al contado.

### Qué necesita el diseño para servirlos bien

| # | Ajuste | Rubro | Lado |
|---|---|---|---|
| R1 | **Horizonte semanal** por defecto ("esta semana" en vez de 14 días) | ambos | FE |
| R2 | **Consolidar el timeline por proveedor** (no 40 líneas del mismo proveedor de verdura; una fila "Proveedor X · 6 compras · próx. pago $Y") | ambos | FE |
| R3 | **Liquidación de tarjetas + timing de entradas/salidas** → vive en la pantalla **Caja** (proyección de flujo), NO en Pagar. Pagar solo consume la caja proyectada resultante. Plata en tránsito ≠ caja disponible. | ambos | 🔴 backend (adquirente) → **Caja** |
| R4 | **Postergabilidad realista**: insumos perecederos = poco/no postergable (si no pagás, no te entregan); proveedores de inventario con plazo = negociable | gastronomía / retail | FE (heurística) + backend (flag) |
| R5 | **Boletas en el lado de Ventas**: el grueso de la venta son boletas (tipo 39/41), no facturas → el Libro v2 "vendió" debe incluirlas | ambos | verificar RCV incluye boletas |
| R6 | **Búsqueda + filtros** que escalen al volumen (por proveedor, categoría, monto) | ambos | FE |

### Lo bueno
- R1, R2, R4 (heurística), R6 son **FE-only** — extensiones del diseño actual, no un rediseño.
- La **concentración por compromiso** ya responde "¿a quién le compro más?" (proveedor de insumos que concentra el gasto → a quién negociarle plazo/precio).
- El **degradado honesto** evita ruido: un café sin leasing simplemente no ve esa categoría.

### Lo que necesita backend
- **R3 (liquidación de tarjetas)** se resuelve en **Caja**, no en Pagar (ver Decisión). Sin ese dato la caja proyectada subestima lo que va a entrar (la venta con tarjeta acredita en T+1/T+2) — decisivo para negocios de caja diaria. Requiere conector del adquirente (Transbank/Getnet/Mercado Pago) o leerlo del banco. Pagar solo **consume** la caja proyectada de Caja; no suma tarjetas en tránsito como disponible.
- **R4 (flag de postergabilidad)** por ítem/categoría, idealmente.

---

## Recomendación

- El diseño cubre bien el **~80% de las PYMEs** tal cual (servicios, mayorista, transporte,
  salud, y retail/gastronomía con los ajustes FE R1/R2/R4/R6).
- **Retail/gastronomía**: el diferenciador real es la **liquidación de tarjetas (R3)**, que
  se resuelve en **Caja** (el flujo), no en Pagar — sin ese dato la cobertura subestima en
  negocios de caja diaria. Escalar a CC-API el conector del adquirente.
- **Construcción/proyecto**: extensión con dimensión "obra" (reusa D1/D2) + estados de
  pago/retenciones — solo si se prioriza ese segmento.
- Validar con **2-3 clientes** de rubros distintos antes de cerrar.

— CC-WEB
