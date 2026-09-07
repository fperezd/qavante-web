/* V07 · Bandeja de excepciones — el modelo PURO (ESPECIFICACION §V07, issue #71).
 *
 * Sin React, sin DOM, sin fetch: entra lo que devuelven los endpoints vivos y sale lo que la
 * pantalla necesita decidir. Todo lo que sigue es testeable con un `expect` y sin browser.
 *
 * LEY 3 — "Ninguna sugerencia sin evidencia dura. Sin RUT en glosa Y sin monto que calce → no hay
 * sugerencia; va a revisión manual. Los chips de 'por qué' solo se muestran si la verificación
 * pasó." Acá eso es literal y es el corazón del archivo:
 *
 *   · `evidenciaConciliar()` devuelve SOLO verificaciones que pasaron. Una verificación que falla
 *     no produce chip: produce, si acaso, una línea de diferencia o un motivo en el "why".
 *   · `haySugerenciaConciliar()` es la compuerta: sin RUT en la glosa Y sin monto que calce, la
 *     card NO ofrece "Sí, conciliar" — ofrece buscar el documento a mano.
 *   · Para clasificar la compuerta es todavía más simple: hay sugerencia SI Y SÓLO SI una regla
 *     activa matcheó (`/suggested-category` con `suggestion != null`). No se infiere de la glosa.
 *
 * Las verificaciones son las que el FRONT puede comprobar contra los DOS lados que muestra la
 * pantalla (glosa del banco ⇄ documento candidato). Los `reasons` que manda el motor en
 * `DocumentSuggestion` NO se pintan como chips a propósito: son texto libre del backend que la
 * vista no puede verificar contra lo que el usuario tiene delante, y un chip que el usuario no
 * puede auditar es exactamente lo que la Ley 3 viene a prohibir.
 *
 * "NO SÉ" EXPLÍCITO — la cola de conciliación (`ReviewItem`) no trae dirección del movimiento; se
 * deriva del `document_kind` de la sugerencia (receivable ⇒ entra plata, payable ⇒ sale) y cuando
 * no se puede derivar queda `null`, y la vista no pinta signo. Un documento sin monto usable deja
 * `monto: null` y la diferencia pasa a "no se puede calcular", nunca a cero. */

import type { BankMovement, BankMovementsListResponse } from "@/lib/api/treasury";
import type { DocumentSuggestionsResponse, ReviewQueueResponse } from "@/lib/api/reconciliation";
import type { SuggestedCategoryResponse } from "@/lib/api/classification-rules";
import {
  ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY,
  type RevertActionResponse,
  type ReversibleActionsListResponse,
} from "@/lib/api/reversible-actions";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";

/* ── Constantes con su cita ──────────────────────────────────────────────────────────────── */

/** Tolerancia del "monto que calce" de la Ley 3 cuando no es exacto: ±1 %. Declarada acá y no
 *  escondida en un `if`, porque es la frontera entre "hay sugerencia" y "revisión manual". */
export const TOLERANCIA_MONTO = 0.01;

/** Un documento a más de 30 días del abono ya no cuenta como evidencia de fecha. */
export const DIAS_FECHA_CERCANA = 30;

/** Un lote existe desde 3 ítems de la misma contraparte (§V07). */
export const MINIMO_LOTE = 3;

/** Banda de "monto parecido" para los 3 frecuentes: de un tercio al triple. Es un apoyo de
 *  escaneo, NO una sugerencia (Ley 3) — por eso puede ser ancha sin mentir. */
export const FACTOR_BANDA_MONTO = 3;

export type DireccionV07 = "credit" | "debit";
export type TabV07 = "conciliar" | "clasificar";

/* ── Ítems de la bandeja ─────────────────────────────────────────────────────────────────── */

export interface ItemConciliarV07 {
  tipo: "conciliar";
  /** `movement_id` del banco. */
  id: string;
  fecha: string;
  /** Magnitud, siempre positiva. El signo lo decide `direccion`. */
  monto: number;
  /** `null` = la cola no dice si entra o sale plata, y no se inventa. */
  direccion: DireccionV07 | null;
  glosa: string | null;
  /** Contraparte que propone el motor (puede no venir). */
  contraparteMotor: string | null;
  /** Score del motor 0-100. `null` si la cola no lo trajo. */
  scoreMotor: number | null;
  /** Cuántos documentos cubre la sugerencia; >1 se aplican TODOS al confirmar (ADR-0076 P0). */
  documentos: number;
  /** `document_id` que el motor propuso, para elegirlo entre los candidatos. */
  documentoPropuesto: string | null;
}

export interface ItemClasificarV07 {
  tipo: "clasificar";
  id: string;
  fecha: string;
  monto: number;
  direccion: DireccionV07;
  glosa: string | null;
  /** RUT encontrado EN la glosa (normalizado, sin puntos). `null` = no hay. */
  rutGlosa: string | null;
}

export type ItemV07 = ItemConciliarV07 | ItemClasificarV07;

export interface CandidatoV07 {
  documentId: string;
  /** 'receivable' (venta) | 'payable' (compra/nómina/BHE). */
  kind: string;
  tipoDte: number | null;
  folio: string | null;
  /** RUT normalizado (sin puntos, con dígito verificador). */
  rut: string | null;
  nombre: string | null;
  /** Monto pendiente del documento. `null` = el contrato no trajo un número usable. */
  monto: number | null;
  fecha: string | null;
  score: number;
}

/* ── Normalizaciones ─────────────────────────────────────────────────────────────────────── */

/** RUT sin puntos ni guion, en mayúsculas: la forma comparable. `null` si no queda nada. */
export function normalizarRut(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const limpio = raw.replace(/[.\-\s]/g, "").toUpperCase();
  return limpio.length >= 2 ? limpio : null;
}

/** Todos los RUT que aparecen en un texto libre, normalizados. Acepta con y sin puntos. */
export function rutsEnTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const encontrados = texto.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g) ?? [];
  const out: string[] = [];
  for (const r of encontrados) {
    const n = normalizarRut(r);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** El primer RUT de la glosa, o `null`. Es la evidencia dura de la Ley 3. */
export function primerRutEnTexto(texto: string | null | undefined): string | null {
  return rutsEnTexto(texto)[0] ?? null;
}

/** Texto comparable: minúsculas, sin tildes, sin puntuación, espacios colapsados. */
export function normalizarTexto(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Días civiles entre dos fechas ISO (`b − a`). `null` si alguna no se reconoce. */
export function diasEntre(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const ca = fechaCivil(a);
  const cb = fechaCivil(b);
  if (!ca || !cb) return null;
  return Math.round((cb - ca) / 86_400_000);
}

function fechaCivil(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return Date.UTC(Number(m[1]), mes - 1, Number(m[3]));
}

/* ── Adaptadores de contrato → ítems ─────────────────────────────────────────────────────── */

/** `receivable` ⇒ entra plata (credit); `payable` ⇒ sale (debit); cualquier otra cosa ⇒ no sé. */
export function direccionDeKind(kind: string | null | undefined): DireccionV07 | null {
  if (kind === "receivable") return "credit";
  if (kind === "payable") return "debit";
  return null;
}

/** `GET /api/treasury/reconciliation/review` → los ítems de la carta de conciliar. */
export function itemsConciliar(resp: ReviewQueueResponse | null | undefined): ItemConciliarV07[] {
  if (!resp?.items) return [];
  return resp.items.map((it) => ({
    tipo: "conciliar" as const,
    id: it.movement_id,
    fecha: it.date,
    monto: Math.abs(parseAmount(it.amount)),
    direccion: direccionDeKind(it.suggestion?.document_kind),
    glosa: it.description ?? null,
    contraparteMotor: it.suggestion?.name ?? null,
    scoreMotor: parseAmountOrNull(it.suggestion?.score ?? null),
    documentos: it.suggestion?.document_count ?? 1,
    documentoPropuesto: it.suggestion?.document_id ?? null,
  }));
}

/** `GET /api/bank-movements?status=unclassified` → los ítems de la carta de clasificar. */
export function itemsClasificar(
  resp: BankMovementsListResponse | null | undefined,
): ItemClasificarV07[] {
  if (!resp?.items) return [];
  return resp.items.map((m) => ({
    tipo: "clasificar" as const,
    id: m.id,
    fecha: m.date,
    monto: Math.abs(parseAmount(m.amount)),
    direccion: m.direction,
    glosa: m.description || null,
    rutGlosa: primerRutEnTexto(m.description),
  }));
}

/** `GET .../{movement_id}/document-suggestions` → candidatos, ordenados por score descendente. */
export function candidatos(resp: DocumentSuggestionsResponse | null | undefined): CandidatoV07[] {
  if (!resp?.suggestions) return [];
  return resp.suggestions
    .map((s) => ({
      documentId: s.document_id,
      kind: s.kind,
      tipoDte: s.document_type ?? null,
      folio: s.folio ?? null,
      rut: normalizarRut(s.rut),
      nombre: s.name ?? null,
      monto: parseAmountOrNull(s.amount),
      fecha: s.date ?? null,
      score: s.score,
    }))
    .sort((a, b) => b.score - a.score);
}

/** El candidato que la card muestra: el que propuso el motor si sigue en la lista; si no, el de
 *  mejor score. `null` si no hay ninguno — y entonces no hay sugerencia (Ley 3). */
export function candidatoElegido(
  lista: CandidatoV07[],
  propuesto: string | null,
  elegidoPorElUsuario?: string | null,
): CandidatoV07 | null {
  if (lista.length === 0) return null;
  if (elegidoPorElUsuario) {
    const manual = lista.find((c) => c.documentId === elegidoPorElUsuario);
    if (manual) return manual;
  }
  if (propuesto) {
    const delMotor = lista.find((c) => c.documentId === propuesto);
    if (delMotor) return delMotor;
  }
  return lista[0] ?? null;
}

/* ── Ley 3: las verificaciones ───────────────────────────────────────────────────────────── */

export type VerificacionV07 =
  | "rut-en-glosa"
  | "folio-en-glosa"
  | "nombre-en-glosa"
  | "monto-exacto"
  | "monto-en-tolerancia"
  | "fecha-cercana";

export interface EvidenciaV07 {
  id: VerificacionV07;
  /** El chip, ya en lenguaje de dueño. */
  texto: string;
}

/** ¿El RUT del documento aparece en la glosa del banco? Comparación normalizada, con y sin DV:
 *  los bancos truncan el dígito verificador a menudo. */
export function rutEnGlosa(glosa: string | null, rutDoc: string | null): boolean {
  const rut = normalizarRut(rutDoc);
  if (!rut) return false;
  const enGlosa = rutsEnTexto(glosa);
  if (enGlosa.includes(rut)) return true;
  const cuerpo = rut.slice(0, -1);
  if (cuerpo.length < 7) return false;
  const soloDigitos = (glosa ?? "").replace(/[.\-\s]/g, "");
  /* Frontera de dígito, igual que `folioEnGlosa`: sin ella, un número de operación más largo
     que contiene el cuerpo del RUT como subcadena pasaba por coincidencia — evidencia falsa. */
  return new RegExp(`(^|[^0-9])${cuerpo}([^0-9]|$)`).test(soloDigitos);
}

/** ¿El folio del documento aparece como número suelto en la glosa? */
export function folioEnGlosa(glosa: string | null, folio: string | null): boolean {
  if (!folio) return false;
  const f = folio.trim();
  /* Un folio de 1-2 dígitos matchea cualquier cosa (un "12" de una fecha, de un monto). No
     cuenta como evidencia: preferimos no dar el chip a darlo por casualidad. */
  if (!/^\d{3,}$/.test(f)) return false;
  return new RegExp(`(^|[^0-9])${f}([^0-9]|$)`).test(glosa ?? "");
}

/** ¿Alguna palabra distintiva del nombre del documento está en la glosa? (≥5 letras, para que
 *  "S.A." o "Ltda" no cuenten como evidencia de nada). */
export function nombreEnGlosa(glosa: string | null, nombre: string | null): boolean {
  const g = normalizarTexto(glosa);
  if (!g) return false;
  const palabras = normalizarTexto(nombre)
    .split(" ")
    .filter((p) => p.length >= 5 && !PALABRAS_VACIAS.includes(p));
  return palabras.some((p) => g.includes(p));
}

const PALABRAS_VACIAS = ["limitada", "sociedad", "comercial", "servicios", "empresa"];

/** Diferencia entre el movimiento y el documento. `null` si el documento no trajo monto. */
export function diferenciaMonto(item: ItemConciliarV07, cand: CandidatoV07 | null): number | null {
  if (!cand || cand.monto == null) return null;
  return item.monto - cand.monto;
}

/** ¿El monto "calza" para la Ley 3? Exacto al peso, o dentro de ±1 % del documento. */
export function montoCalza(item: ItemConciliarV07, cand: CandidatoV07 | null): boolean {
  const dif = diferenciaMonto(item, cand);
  if (dif == null || !cand || cand.monto == null || cand.monto === 0) return false;
  return Math.abs(dif) <= Math.abs(cand.monto) * TOLERANCIA_MONTO;
}

/**
 * Los chips del why-strip: SÓLO las verificaciones que PASARON (Ley 3).
 *
 * Si una verificación no pasa, acá no aparece nada — ni un chip tachado, ni un chip en gris, ni
 * un chip que diga "no calza". Lo que no pasó se cuenta en el "why" de arriba y en la línea de
 * diferencia, que es prosa sobre un número que el usuario ve, no evidencia a favor.
 */
export function evidenciaConciliar(
  item: ItemConciliarV07,
  cand: CandidatoV07 | null,
): EvidenciaV07[] {
  if (!cand) return [];
  const out: EvidenciaV07[] = [];
  if (rutEnGlosa(item.glosa, cand.rut)) out.push({ id: "rut-en-glosa", texto: "RUT en la glosa" });
  if (folioEnGlosa(item.glosa, cand.folio)) {
    out.push({ id: "folio-en-glosa", texto: `folio ${cand.folio} en la glosa` });
  }
  if (nombreEnGlosa(item.glosa, cand.nombre)) {
    out.push({ id: "nombre-en-glosa", texto: "el nombre de la contraparte en la glosa" });
  }
  const dif = diferenciaMonto(item, cand);
  if (dif != null && Math.round(Math.abs(dif)) === 0) {
    out.push({ id: "monto-exacto", texto: "monto exacto" });
  } else if (montoCalza(item, cand)) {
    out.push({ id: "monto-en-tolerancia", texto: "monto dentro de ±1 %" });
  }
  const dias = diasEntre(cand.fecha, item.fecha);
  if (dias != null && Math.abs(dias) <= DIAS_FECHA_CERCANA) {
    out.push({ id: "fecha-cercana", texto: textoDias(dias) });
  }
  return out;
}

function textoDias(dias: number): string {
  const n = Math.abs(dias);
  if (n === 0) return "mismo día que el documento";
  return n === 1 ? "a 1 día del documento" : `a ${n} días del documento`;
}

/**
 * LA COMPUERTA de la Ley 3, literal: "Sin RUT en glosa Y sin monto que calce → no hay
 * sugerencia; va a revisión manual."
 */
export function haySugerenciaConciliar(item: ItemConciliarV07, cand: CandidatoV07 | null): boolean {
  if (!cand) return false;
  return rutEnGlosa(item.glosa, cand.rut) || montoCalza(item, cand);
}

/** Por qué el piloto NO lo resolvió solo, leído de los dos lados que la pantalla muestra. Nunca
 *  inventa un motivo del motor: enumera qué verificación falta. */
export function motivosNoAutomatico(item: ItemConciliarV07, cand: CandidatoV07 | null): string[] {
  if (!cand) return ["el motor no encontró un documento candidato"];
  const out: string[] = [];
  const dif = diferenciaMonto(item, cand);
  if (dif == null) out.push("el documento no trae monto comparable");
  else if (Math.round(Math.abs(dif)) !== 0) out.push("el monto no calza exacto");
  if (!rutEnGlosa(item.glosa, cand.rut)) out.push("el RUT no aparece en la glosa");
  const dias = diasEntre(cand.fecha, item.fecha);
  if (dias != null && Math.abs(dias) > DIAS_FECHA_CERCANA) out.push("la fecha está lejos");
  if (out.length === 0) out.push("el motor no superó su umbral de confianza");
  return out;
}

export type ParcialidadV07 =
  | { tipo: "sin-candidato" }
  | { tipo: "sin-monto" }
  | { tipo: "exacta" }
  | { tipo: "parcial"; monto: number; restante: number }
  | { tipo: "exceso"; monto: number };

/** La línea de diferencia/parcialidad de la card (§V07). */
export function parcialidad(item: ItemConciliarV07, cand: CandidatoV07 | null): ParcialidadV07 {
  if (!cand) return { tipo: "sin-candidato" };
  if (cand.monto == null) return { tipo: "sin-monto" };
  const dif = item.monto - cand.monto;
  if (Math.round(Math.abs(dif)) === 0) return { tipo: "exacta" };
  if (dif < 0) return { tipo: "parcial", monto: Math.abs(dif), restante: cand.monto - item.monto };
  return { tipo: "exceso", monto: dif };
}

/* ── Carta de clasificar ─────────────────────────────────────────────────────────────────── */

export interface OpcionCuentaV07 {
  id: string;
  nombre: string;
  /** `false` ⇒ se muestra pero no se puede elegir (cuenta desactivada). */
  seleccionable: boolean;
}

export interface SugerenciaCategoriaV07 {
  cuentaId: string | null;
  nombre: string;
  /** [0..1] tal como la publica el backend. */
  confianza: number;
  reglaId: string | null;
}

/**
 * Sugerencia de categoría — SÓLO si una regla activa matcheó (Ley 3). El endpoint devuelve
 * `suggestion: null` cuando ninguna regla aplica, y entonces acá también es `null`: la vista no
 * infiere una categoría de la glosa ni "propone la más probable".
 *
 * La cuenta se resuelve por CÓDIGO contra el catálogo, porque `SuggestedCategory` publica
 * `account_code`/`account_name` y no el id que `classify` necesita. Sin match en el catálogo la
 * sugerencia se devuelve con `cuentaId: null`: se puede mostrar, pero no se puede guardar de un
 * Enter, y la vista lo dice en vez de mandar un id inventado.
 */
export function sugerenciaCategoria(
  resp: SuggestedCategoryResponse | null | undefined,
  cuentasPorCodigo: ReadonlyMap<string, OpcionCuentaV07>,
): SugerenciaCategoriaV07 | null {
  const s = resp?.suggestion;
  if (!s) return null;
  const cuenta = s.account_code ? cuentasPorCodigo.get(s.account_code) : undefined;
  const nombre = cuenta?.nombre ?? s.account_name ?? s.account_code;
  if (!nombre) return null;
  return {
    cuentaId: cuenta?.seleccionable ? cuenta.id : null,
    nombre,
    confianza: s.confidence,
    reglaId: s.matched_rule_id ?? null,
  };
}

export interface FrecuenteV07 {
  cuentaId: string;
  nombre: string;
  veces: number;
}

export type CriterioFrecuentesV07 = "monto-y-direccion" | "direccion" | "ninguno";

export interface FrecuentesV07 {
  items: FrecuenteV07[];
  /** Con qué criterio se armó la lista — la vista lo DICE, no lo esconde. */
  criterio: CriterioFrecuentesV07;
}

/**
 * Las 3 categorías que más usaste en movimientos parecidos (§V07: "sin evidencia → sin sugerencia
 * + 3 frecuentes por monto/dirección").
 *
 * NO es una sugerencia y la vista no puede presentarlo como tal: es un atajo construido sobre tu
 * propio historial. Por eso devuelve además el CRITERIO con el que se armó — si la banda de monto
 * no dio nada, se cae a "misma dirección" y se dice, en vez de mostrar tres nombres bajo un
 * rótulo que promete algo que no se cumplió.
 */
export function frecuentes(
  clasificados: readonly BankMovement[],
  item: ItemClasificarV07,
  cuentasPorId: ReadonlyMap<string, OpcionCuentaV07>,
  max = 3,
): FrecuentesV07 {
  const mismaDireccion = clasificados.filter(
    (m) => m.direction === item.direccion && m.management_account_id,
  );
  const piso = item.monto / FACTOR_BANDA_MONTO;
  const techo = item.monto * FACTOR_BANDA_MONTO;
  const enBanda = mismaDireccion.filter((m) => {
    const v = Math.abs(parseAmount(m.amount));
    return item.monto > 0 && v >= piso && v <= techo;
  });

  const porBanda = contar(enBanda, cuentasPorId, max);
  if (porBanda.length > 0) return { items: porBanda, criterio: "monto-y-direccion" };
  const porDireccion = contar(mismaDireccion, cuentasPorId, max);
  if (porDireccion.length > 0) return { items: porDireccion, criterio: "direccion" };
  return { items: [], criterio: "ninguno" };
}

function contar(
  movs: readonly BankMovement[],
  cuentasPorId: ReadonlyMap<string, OpcionCuentaV07>,
  max: number,
): FrecuenteV07[] {
  const cuenta = new Map<string, number>();
  for (const m of movs) {
    const id = m.management_account_id;
    if (!id) continue;
    cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }
  return (
    [...cuenta.entries()]
      .map(([cuentaId, veces]) => ({ cuentaId, veces, nombre: cuentasPorId.get(cuentaId)?.nombre }))
      /* Una cuenta que el catálogo no conoce no se muestra con su UUID: se omite. Mostrar el id
       crudo sería pedirle al dueño que elija algo que no puede leer. */
      .filter((f): f is FrecuenteV07 => typeof f.nombre === "string" && f.nombre.length > 0)
      .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre))
      .slice(0, max)
  );
}

export interface BorradorClasificarV07 {
  cuentaId: string | null;
  notas: string;
}

/**
 * LEY 6 — "Ningún botón deshabilitado mudo: el primario siempre responde; si falta algo, al
 * pulsar se marca en rojo qué falta."
 *
 * Esta función es el "qué falta". El botón Guardar NUNCA se deshabilita: se pulsa, y si esto
 * devuelve un texto, ese texto se pinta en rojo (el ÚNICO rojo de la pantalla, Ley 2).
 */
export function faltaParaGuardar(borrador: BorradorClasificarV07): string | null {
  if (!borrador.cuentaId) return "Elige una categoría para guardar este movimiento.";
  return null;
}

/* ── Lotes (group-by) ────────────────────────────────────────────────────────────────────── */

export interface LoteV07 {
  /** Clave de agrupación (RUT normalizado o glosa normalizada). */
  clave: string;
  /** Cómo se llama el grupo en pantalla. */
  etiqueta: string;
  /** `true` si la contraparte se identificó por RUT; `false` = agrupado por glosa (heurística). */
  porRut: boolean;
  /** Cuántos OTROS ítems comparten la clave (sin contar el que estás viendo). */
  otros: number;
  /** Los ids de todos los del grupo, en el orden de la cola. */
  ids: string[];
}

/** Clave de contraparte de un ítem por clasificar: el RUT de la glosa si existe; si no, la glosa
 *  normalizada (heurística declarada — dos glosas idénticas suelen ser la misma contraparte). */
export function claveContraparte(item: ItemClasificarV07): string | null {
  if (item.rutGlosa) return `rut:${item.rutGlosa}`;
  const g = normalizarTexto(item.glosa);
  return g ? `glosa:${g}` : null;
}

/**
 * §V07 — "si hay ≥3 ítems de la misma contraparte → banner 'Hay N más de X'".
 *
 * Devuelve el grupo del ítem en pantalla, o `null` si no llega a 3. La vista puede ofrecer el
 * bulk manual y atómico de API #350 cuando el usuario elige una categoría y lo confirma. Agrupar
 * primero mantiene visible qué movimientos entrarán en esa decisión; no se infiere una categoría.
 */
export function lote(
  items: readonly ItemClasificarV07[],
  actual: ItemClasificarV07 | null,
): LoteV07 | null {
  if (!actual) return null;
  const clave = claveContraparte(actual);
  if (!clave) return null;
  const grupo = items.filter((i) => claveContraparte(i) === clave);
  if (grupo.length < MINIMO_LOTE) return null;
  return {
    clave,
    etiqueta: actual.rutGlosa ?? (actual.glosa ?? "").trim(),
    porRut: actual.rutGlosa != null,
    otros: grupo.length - 1,
    ids: grupo.map((i) => i.id),
  };
}

/** Reordena la cola para que los del lote queden juntos, empezando por el actual. Puro. */
export function agruparAlFrente(
  items: readonly ItemClasificarV07[],
  indiceActual: number,
  ids: readonly string[],
): ItemClasificarV07[] {
  const actual = items[indiceActual];
  if (!actual) return [...items];
  const delLote = items.filter((i) => i.id !== actual.id && ids.includes(i.id));
  const resto = items.filter((i) => i.id !== actual.id && !ids.includes(i.id));
  return [actual, ...delLote, ...resto];
}

/* ── Cola, avance y progreso ─────────────────────────────────────────────────────────────── */

/**
 * AUTO-AVANCE al resolver: el ítem resuelto SALE de la cola, así que el mismo índice ya apunta al
 * siguiente. Lo único que hay que hacer es no pasarse del final.
 *
 * Sumarle 1 acá sería saltarse un ítem sin resolverlo — el mutante (d) del pase. Por eso esta
 * función existe separada de `trasSaltar`, que sí avanza.
 */
export function trasResolver(indice: number, largoDespues: number): number {
  if (largoDespues <= 0) return 0;
  return Math.min(indice, largoDespues - 1);
}

/** SALTAR: el ítem se queda en la cola y pasamos al siguiente, con vuelta al principio. */
export function trasSaltar(indice: number, largo: number): number {
  if (largo <= 0) return 0;
  return (indice + 1) % largo;
}

export interface ProgresoV07 {
  resueltos: number;
  total: number;
  /** 0-100, acotado. */
  pct: number;
}

/**
 * La barra de progreso. `total` = lo que había al abrir + lo que se resolvió, o sea el
 * denominador NO se mueve cuando resuelves (si no, la barra nunca avanzaría).
 */
export function progreso(resueltos: number, pendientes: number): ProgresoV07 {
  const total = resueltos + Math.max(0, pendientes);
  if (total <= 0) return { resueltos: 0, total: 0, pct: 0 };
  const pct = Math.min(100, Math.max(0, Math.round((resueltos / total) * 100)));
  return { resueltos, total, pct };
}

/** Suma de los montos resueltos en la sesión. Puro, en pesos. */
export function montoResuelto(montos: readonly number[]): number {
  return montos.reduce((a, b) => a + Math.abs(b), 0);
}

/* ── Ley 5 en clasificar: lo que Qavante clasificó SOLO, todavía deshacible ─────────────────
 *
 * VERIFICADO contra `api/app/core/reversible_actions.py` y `treasury_repo.classify_movement`
 * (qavante-api#257, mergeado): el `PATCH .../classify` que dispara "Guardar" en esta carta NUNCA
 * registra una acción reversible — sólo lo hacen los dos automatismos por lote (`apply-rules`,
 * `classify-reconciled`), y la Ley 5 es literal en el propio código: "cubre lo que Qavante hace
 * SOLO, no lo que el usuario decide". Por eso NO hay Deshacer para el clic de "Guardar" (ver
 * `bandeja-v07-view.tsx`), y lo que sí se ofrece acá es la bitácora de esos dos automatismos:
 * deshacer una de sus filas devuelve el movimiento a "sin clasificar" — de vuelta a esta carta. */

export interface AccionAutoClasificarV07 {
  actionId: string;
  /** Texto humano que ya trae el backend (p. ej. "Clasificamos un movimiento con la regla…"). */
  resumen: string;
  creadaEn: string;
  vencePlazo: string;
}

/** Las auto-clasificaciones de movimientos bancarios TODAVÍA deshacibles, del listado
 *  `GET /api/reversible-actions`. Filtra por `action_type` Y por `undo_available`: el query
 *  `only_undoable` es un ahorro de tráfico del backend, no una garantía por ítem — un ítem puede
 *  volver con `undo_available: false` si el estado derivó desde que se armó la página (ver la
 *  cita en `reversible-actions.ts`), y ofrecer un Deshacer ahí sería el botón mudo que la Ley 6
 *  prohíbe. Orden: el que trae el backend (más reciente primero, `created_at DESC`). */
export function accionesAutoClasificar(
  resp: ReversibleActionsListResponse | null | undefined,
): AccionAutoClasificarV07[] {
  if (!resp?.items) return [];
  return resp.items
    .filter((i) => i.action_type === ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY && i.undo_available)
    .map((i) => ({
      actionId: i.action_id,
      resumen: i.summary,
      creadaEn: i.created_at,
      vencePlazo: i.undo_expires_at,
    }));
}

const MOTIVO_ESTADO_DERIVADO = "estado_derivado";
const MOTIVO_ESTADO_BLOQUEADO = "estado_bloqueado";

const EXPLICACION_DERIVADO_POR_DEFECTO =
  "Algo cambió después de esta clasificación automática (probablemente la reclasificaste tú). Ese cambio sigue en pie: no se tocó nada.";
const EXPLICACION_BLOQUEADO_POR_DEFECTO =
  "Otra operación está usando este movimiento justo ahora. No se tocó nada; puedes reintentar en unos segundos.";

export type ResultadoDeshacerV07 =
  | { tipo: "deshecho" }
  | { tipo: "ya-deshecho" }
  | { tipo: "vencido" }
  /** `estado_derivado` (ADR-0113): el usuario cambió algo después de la acción automática. No se
   *  tocó nada. NO reintentable — lo que cambió sigue vigente y así debe quedar; reintentar no
   *  arregla nada porque no hay nada roto. */
  | { tipo: "protegido"; explicacion: string }
  /** `estado_bloqueado` (ADR-0113): otra operación tiene la fila tomada AHORA MISMO. No se tocó
   *  nada. SÍ reintentable. */
  | { tipo: "bloqueado"; explicacion: string }
  /** El backend respondió `undo_not_supported` sin ninguno de los dos motivos reconocidos (o sin
   *  `detail` legible). No se inventa cuál es — "no sé" explícito (Ley 8, política anti-default). */
  | { tipo: "no-reconocido" };

/**
 * Traduce la respuesta cruda de `POST .../revert` (ADR §4) a lo que la vista necesita decidir:
 * qué mensaje mostrar y si tiene sentido ofrecer reintentar. Puro — sin React, testeable con un
 * solo `expect`.
 *
 * LA COMPUERTA que pide el issue #90: colapsar `estado_derivado` y `estado_bloqueado` en un "no
 * se pudo deshacer" genérico es el default plausible que la política prohíbe. Acá es literal: un
 * `tipo` DISTINTO para cada uno, con el texto que manda el backend (no uno inventado en el FE) y
 * sólo un texto por defecto si `detail.explicacion` no vino.
 */
export function interpretarDeshacer(resp: RevertActionResponse): ResultadoDeshacerV07 {
  switch (resp.result) {
    case "reverted":
      return { tipo: "deshecho" };
    case "already_reverted":
      return { tipo: "ya-deshecho" };
    case "undo_expired":
      return { tipo: "vencido" };
    case "undo_not_supported": {
      const motivo = typeof resp.detail?.motivo === "string" ? resp.detail.motivo : null;
      const explicacion =
        typeof resp.detail?.explicacion === "string" ? resp.detail.explicacion : null;
      if (motivo === MOTIVO_ESTADO_DERIVADO) {
        return { tipo: "protegido", explicacion: explicacion ?? EXPLICACION_DERIVADO_POR_DEFECTO };
      }
      if (motivo === MOTIVO_ESTADO_BLOQUEADO) {
        return { tipo: "bloqueado", explicacion: explicacion ?? EXPLICACION_BLOQUEADO_POR_DEFECTO };
      }
      return { tipo: "no-reconocido" };
    }
    default:
      return { tipo: "no-reconocido" };
  }
}
