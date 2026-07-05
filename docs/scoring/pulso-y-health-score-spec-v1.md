# Especificación v1 — PULSO y Qavante Health Score (QHS)

> **Estado:** propuesta metodológica para validación de Fernando y calibración con datos reales.
> **Origen:** sesión de asesoría CEO/Controller (2026-07-05) sobre el documento
> `Qavante_Health_Score_Documento_Tecnico_Completo.docx`.
> **Ámbito:** este documento define la METODOLOGÍA (fórmulas, pesos, umbrales,
> guardrails). El cálculo es **lógica de negocio del backend** (CLAUDE.md); el FE
> solo muestra resultados vía contratos como
> [`pulso-detail-contract.md`](../backend-contracts/pulso-detail-contract.md).
> Los umbrales de este documento son puntos de partida para pyme chilena y deben
> vivir en configuración versionada (`q_score_model_version`), nunca hardcodeados.

---

## 1. Arquitectura: dos instrumentos, separación de frecuencias

Qavante entrega dos índices complementarios que miden cosas distintas en ventanas
distintas. Ninguna señal de corto plazo entra cruda al QHS, y el QHS no re-mide
la caja de hoy. Esto evita doble conteo y mantiene cada instrumento estable en
su frecuencia natural.

| | **PULSO** | **Health Score (QHS)** |
|---|---|---|
| Pregunta | ¿Llego a fin de mes? | ¿La empresa mejora, se estanca o se deteriora? ¿Puedo tomar la decisión X? |
| Horizonte | 0–30 días | 6–12 meses |
| Datos | Saldo actual, calendario de pagos/cobros | Ventanas móviles de 3/6/12 meses |
| Frecuencia de cálculo | Diaria (volátil por diseño) | Mensual (estable por diseño, con histéresis) |
| Metáfora | Pulso cardíaco | Examen de sangre anual |

**Relación con el documento Health Score original:** el subíndice LIQ completo y
la mitad de corto plazo de RISK se mudan a PULSO. El QHS gana un subíndice nuevo,
**Trayectoria (TRAY)**, que responde explícitamente "¿creciendo / estancada / de
baja?" — dimensión que el documento original no aislaba.

---

## 2. PULSO — termómetro de corto plazo (0–100, diario)

### 2.1 Fórmula

```
PULSO = 0.40·COB + 0.25·RUN + 0.20·DPC + 0.15·CAL
```

Toda normalización es lineal por tramos entre los puntos indicados.
Transferencias internas se excluyen de todos los componentes.

### 2.2 COB — Cobertura de compromisos a 30 días (40%)

```
COB_ratio = (Caja disponible + Cobros esperados ponderados 30d) / Egresos comprometidos 30d
```

- **Cobros esperados ponderados** = Σ (factura por cobrar con vencimiento ≤30d ×
  probabilidad de pago del pagador). La probabilidad sale del historial del
  pagador (% pagado a tiempo, atraso promedio). Pagador sin historial → 60%.
  Pagador con atraso activo → 0% en esta ventana (se cuenta cuando aparece en el
  banco, no antes).
- **Egresos comprometidos** = proveedores que vencen ≤30d + **nómina estimada** +
  **IVA/PPM del F29 estimado desde DTEs** (débito fiscal − crédito fiscal) +
  **cotizaciones previsionales** + servicio de deuda ≤30d + recurrentes
  (arriendo, servicios).

| COB_ratio | ≥1.5 | 1.2 | 1.0 | 0.8 | ≤0.6 |
|---|---|---|---|---|---|
| Score | 100 | 85 | 60 | 30 | 0 |

Ratio 1.0 da 60, no 80: cubrir justo los compromisos con cobros *esperados* es
equilibrio precario, no holgura.

### 2.3 RUN — Runway operativo (25%)

```
RUN_semanas = Caja disponible / Egreso recurrente semanal promedio (12 semanas, excl. extraordinarios)
```

Solo caja actual, sin cobros esperados: el runway mide cuánto aguanta la empresa
si *nadie* le paga.

| Semanas | ≥12 | 8 | 4 | 2 | ≤1 |
|---|---|---|---|---|---|
| Score | 100 | 80 | 50 | 20 | 0 |

### 2.4 DPC — Días hasta el punto crítico (20%)

Proyección diaria de caja a 30 días (calendario de cobros ponderados y pagos
comprometidos). DPC = primer día en que la caja proyectada cae bajo el **umbral
mínimo** (sugerido: el monto de una nómina, o 1 semana de egresos recurrentes,
lo que sea mayor).

| Cruce del umbral | Sin cruce en 30d | Día 21–30 | Día 11–20 | Día ≤10 | Ya bajo umbral |
|---|---|---|---|---|---|
| Score | 100 | 70 | 40 | 10 | 0 |

### 2.5 CAL — Calidad del flujo entrante (15%)

```
CAL_% = Entradas operacionales (cobros de clientes) / Entradas totales, últimos 30d
```

Evita que un crédito recién girado pinte el PULSO de verde.

| % operacional | ≥85% | 70% | 50% | <30% |
|---|---|---|---|---|
| Score | 100 | 75 | 40 | 0 |

### 2.6 Guardrails de PULSO (knock-outs)

1. **DPC ≤ 10 días → PULSO máximo 40**, sin importar el promedio ponderado.
2. **Nómina en ≤7 días no cubierta con caja actual** (sin contar cobros
   esperados) → PULSO máximo 30 + alerta prioritaria. Los sueldos son la línea
   roja: se puede estirar a un proveedor, nunca a la gente.

### 2.7 Bandas de PULSO

| Rango | Banda | Mapping al contrato FE (`status`) |
|---|---|---|
| 80–100 | Holgado | `strong` |
| 60–79 | Estable | `stable` |
| 40–59 | Ajustado | `weak` |
| 20–39 | Tenso | `weak` (con drivers de alta severidad) |
| 0–19 | Crítico | `critical` |

> Nota: el contrato FE vigente (`pulso-detail-contract.md`) define 4 estados.
> Las 5 bandas metodológicas se colapsan como arriba; los knock-outs fuerzan
> `critical`, coherente con la semántica ya documentada. Los `components[]` del
> contrato deben migrar a COB/RUN/DPC/CAL cuando el backend implemente este motor
> (punto abierto para CC-API).

---

## 3. QHS — salud estructural (0–100, mensual)

### 3.1 Fórmula

```
QHS = 0.25·TRAY + 0.25·GEN + 0.20·RES + 0.15·DEBT + 0.15·EXP
```

### 3.2 TRAY — Trayectoria (25%)

Responde "¿crece, se estanca o cae?".

```
g = (Cobros operacionales últimos 6m / Cobros mismos 6m del año anterior) − 1
```

Siempre contra el *mismo período* del año anterior (neutraliza estacionalidad).
Con <13 meses de historia: 3m vs 3m anteriores anualizado, y baja el Data
Confidence.

| g | ≥ +20% | +10% | 0% | −10% | ≤ −25% |
|---|---|---|---|---|---|
| Score | 95 | 85 | 60 | 35 | 10 |

Ajustes:

- Crecimiento con margen de caja cayendo → **tope 70** + reason code
  "crecimiento que no se convierte en caja".
- Componente de cartera (±10 pts): pagadores recurrentes nuevos vs perdidos.
  Churn observable = pagador recurrente que deja de facturar 2+ ciclos. Crecer
  ganando clientes ≠ crecer facturando más a los mismos.

### 3.3 GEN — Generación de caja (25%)

```
Margen de caja = (Cobros operacionales − Pagos operacionales) / Cobros operacionales   [móvil 12m]
```

| Margen | ≥15% | 8% | 3% | 0% | −5% | ≤−10% |
|---|---|---|---|---|---|---|
| Score | 100 | 80 | 60 | 45 | 20 | 0 |

Complementos:

- % de meses con caja operacional positiva en los últimos 12 (≥9 → pleno; ≤4 →
  castigo fuerte).
- Conversión facturación→cobro: % de DTEs emitidos cobrados dentro de 60 días.

### 3.4 RES — Resiliencia (20%)

Capacidad de absorber un shock. Tres componentes:

**Colchón estructural** — meses de egresos cubiertos por la **caja promedio
trimestral** (no el saldo de hoy; eso es PULSO):

| Meses | ≥3 | 2 | 1 | <0.5 |
|---|---|---|---|---|
| Score | 100 | 75 | 45 | 10 |

**Concentración mitigada** — score base por participación del pagador top 1:

| Top 1 | <15% | 30% | 50% | ≥70% |
|---|---|---|---|---|
| Base | 100 | 75 | 45 | 20 |

Más hasta **+25 pts de mitigación** si el pagador tiene ≥12 meses de recurrencia
y atraso promedio <7 días. **Tope 90**: la dependencia mitigada sigue siendo
dependencia.

**Flexibilidad de gasto** — % de egresos variables sobre el total. Una empresa
con 80% de gasto fijo no puede achicarse ante un shock.

### 3.5 DEBT — Endeudamiento y presión financiera (15%)

```
DSCR observable = Caja operacional 12m / Servicio de deuda 12m
```

| DSCR | ≥2.0 | 1.5 | 1.2 | 1.0 | <0.8 |
|---|---|---|---|---|---|
| Score | 100 | 80 | 60 | 40 | 10 |

Guardrails internos:

- Caja operacional negativa **y** deuda neta entrando durante 2+ trimestres →
  **tope DEBT 35** ("la deuda financia el déficit, no el crecimiento").
- Factoring >40% de los cobros durante 6+ meses → penalización por dependencia
  estructural. Ojo con la identidad del pagador: cuando el cliente factoriza, el
  pagador observado en banco es el factor, no el cliente (afecta también RES).

### 3.6 EXP — Disciplina de gastos (15%)

```
Elasticidad = Δ% egresos recurrentes / Δ% cobros operacionales   [móvil 6m]
```

| Elasticidad | ≤0.8 | 1.0 | 1.3 | ≥1.5 |
|---|---|---|---|---|
| Score | 100 | 70 | 40 | 15 |

Complementos:

- Creep de gasto fijo: nuevos egresos recurrentes de los últimos 6m como % del
  ingreso.
- Anomalías: egresos > μ+2.5σ de su categoría sin marca de inversión /
  extraordinario.

### 3.7 Guardrails de QHS

1. **PULSO promedio 30 días < 30 → QHS máximo 55.** No existe empresa "sana" que
   no llega a fin de mes. Único puente entre instrumentos, en una sola dirección.
2. GEN < 40 por 2 trimestres consecutivos → tope 60.
3. Data Confidence < 55 → score marcado "preliminar", sin recomendaciones fuertes.

### 3.8 Estabilidad e histéresis

QHS se recalcula mensual sobre ventanas móviles. **Histéresis en las bandas**:
solo cambia de banda si cruza el límite por ≥3 puntos o lo sostiene 2 meses
consecutivos. Un score que oscila entre bandas mes a mes se percibe como ruido y
destruye la confianza del usuario.

Las bandas de QHS son las del documento Health Score original (85–100 muy sana ·
70–84 sana con alertas · 55–69 en observación · 40–54 vulnerable · 0–39 riesgo
alto).

---

## 4. Matriz de lectura conjunta

La combinación de ambos instrumentos es el diagnóstico ejecutivo:

| | **QHS alto (sana)** | **QHS bajo (deteriorada)** |
|---|---|---|
| **PULSO alto** | Crecer, invertir, negociar desde fuerza | ⚠️ La más traicionera: hoy hay caja pero se desangra lento. Reestructurar ahora. |
| **PULSO bajo** | Apretón transitorio de empresa sana: financiamiento puente calzado es legítimo | Crisis: modo sobrevivencia |

El cuadrante PULSO alto / QHS bajo es donde mueren las pymes que "nunca vieron
venir" el problema — el dueño paga las cuentas hoy y no percibe el deterioro
estructural. Ningún banco ni contador le muestra ese cuadrante.

---

## 5. Semáforo de decisiones

Reglas objetivas sobre los dos scores; convierten el índice en herramienta
("¿puedo tomar la decisión X?"):

| Decisión | Requisito sugerido v1 |
|---|---|
| Contratar (gasto fijo nuevo) | GEN ≥ 60 **y** RES ≥ 55 **y** PULSO promedio 30d ≥ 60 |
| Tomar deuda de largo plazo | DSCR proyectado con la nueva cuota ≥ 1.3 **y** GEN ≥ 50 |
| Invertir en activos / crecimiento | QHS ≥ 65 **y** colchón post-inversión ≥ 1.5 meses |
| Repartir retiros / dividendos | GEN ≥ 65 **y** TRAY ≥ 55 **y** colchón ≥ 2 meses |

---

## 6. Consideraciones de implementación (no negociables)

1. **Retiros de socio como categoría propia.** Modo de muerte más común: el
   dueño retira como si la facturación fuera utilidad. Retiros crecientes +
   margen de caja cayendo = reason code propio y alerta directa.
2. **No castigar la inversión.** Una compra grande de equipamiento destroza GEN
   y EXP ese mes. Requiere marca de "inversión/extraordinario" (sugerida por
   monto atípico, confirmada por el usuario) o se generan falsas alarmas.
3. **IVA como ciudadano de primera clase.** Débito − crédito fiscal desde DTEs =
   F29 estimado. Es el egreso comprometido más predecible y el que más
   sobregiros causa. Feature de mayor valor/costo del sistema.
4. **Cobros esperados siempre ponderados, nunca al 100%.** El optimismo del
   dueño ya está incluido de fábrica; el software es el pesimista de la relación.
5. **Cold start como historia de producto.** PULSO funciona con 30 días de
   datos; QHS necesita 6+ meses. Lanzar PULSO de inmediato y mostrar el QHS
   "construyéndose" (barra de progreso: "3 de 6 meses de historia").
6. **Caja ≠ contabilidad, explícito en pantalla.** El margen de caja no es la
   utilidad del balance y el contador del cliente lo va a objetar. La frase
   "medimos caja, no contabilidad" ahorra la mitad de los tickets de soporte.
7. **Umbrales en configuración versionada** (`q_score_model_version` del doc
   Health Score), nunca en código. Calibrar con los primeros ~100 clientes.
8. **Backtesting con un objetivo por instrumento.** PULSO se valida contra
   sobregiros y atrasos de nómina reales ("¿lo anticipó con 10+ días?"); QHS
   contra migraciones de banda a 6 meses. **Falso negativo de PULSO (verde
   seguido de sobregiro) es el peor bug posible del producto** — prioridad uno.

---

## 7. Puntos abiertos

- [ ] Validación de Fernando de pesos y umbrales v1.
- [ ] CC-API: implementar el motor y alinear `components[]` del contrato
  `/api/management/pulso` con COB/RUN/DPC/CAL (hoy el contrato FE-first usa
  liquidez/cobranza/rentabilidad como placeholder).
- [ ] Definir contrato del QHS (endpoint separado o extensión del dashboard).
- [ ] Estimación de nómina cuando no hay dato de remuneraciones: inferir del
  histórico bancario (pagos clasificados como remuneraciones, mismos días del mes).
- [ ] Resolver identidad de pagador bajo factoring (matching factor ↔ cliente).

---

*Generated by CC-WEB — sesión de definición metodológica con Fernando, 2026-07-05.*
