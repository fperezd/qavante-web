/* Motor de TÉRMINOS DE PAGO (2026-07-20) — SIN React, testeable. Base compartida
 * de los tres maestros (clientes/proveedores/honorarios).
 *
 * El SII no entrega fechas de vencimiento (data_state "partial"). Como control, las
 * DERIVAMOS: vencimiento = fecha de emisión + término de pago. El término tiene un
 * default por tipo (ventas 30, compras 30, honorarios 5 días) y se puede editar por
 * contraparte (se persiste en las prefs de UI #571). Con eso, cada documento tiene un
 * vencimiento estimado y podemos priorizar por mora.
 *
 * HONESTIDAD (§13): el vencido se deriva sobre lo FACTURADO (RCV/BHE). Cuando el caller
 * NO pasa `conciliacion`, no descuenta cobros/pagos: es un control de vencimientos.
 * Cuando SÍ la pasa (maestro de Términos), el estado real lo da el motor de conciliación
 * (`POST /api/treasury/reconciliation/document-resolution/statuses`) y un documento
 * conciliado contra un movimiento bancario desaparece de la lista. */

import type { PreferencesBlob } from "@/lib/api/preferences";
import { normalizeRut } from "@/lib/validators/rut";
import {
  agruparConReferencias,
  type PendingAssociationStatus,
} from "@/components/sii/rcv-anuladas";

export type MaestroKind = "ventas" | "compras" | "honorarios";

/** Término de pago default por tipo de documento (días desde la emisión). */
export const TERMINO_DEFAULT: Record<MaestroKind, number> = {
  ventas: 30,
  compras: 30,
  honorarios: 5,
};

/** Documento mínimo que necesita el maestro (subset de RcvDoc / BheRecibida, ya
 *  adaptado: monto resuelto al campo relevante según la fuente). */
export interface DocConVencimiento {
  /** RUT de la contraparte (cliente/proveedor/emisor). */
  rut: string;
  /** Razón social / nombre de la contraparte. */
  name: string;
  /** Fecha de emisión: "DD/MM/YYYY" (RCV) o ISO "YYYY-MM-DD". */
  fecha: string;
  /** Monto del documento (CLP, magnitud; el signo lo aplica el motor según el tipo). */
  monto: number;
  folio?: number | string | null;
  /** Código de tipo de documento del SII (33 factura, 61 NC, 56 ND…). Las NC restan. */
  tipoDoc?: number;
  /** Folio del documento que esta NC/ND modifica (SII `ref_folio`) — para vincular NC↔factura. */
  refFolio?: number;
  /** Tipo del documento referenciado (SII `ref_tipo_doc`). */
  refTipoDoc?: number;
  /** El receptor RECLAMÓ el documento en el SII → no cuenta (monto $0); el FE pinta una "R". */
  reclamado?: boolean;
  /** La factura fue CEDIDA (factoring, RPETC): la cobra el factor, no la empresa → NO es por-cobrar. */
  cedido?: boolean;
  /** Clave natural con la que el dominio identifica este documento (`tipo-folio-rut` en RCV,
   *  `YYYYMM:rut:folio` en BHE). Es la llave con la que se pide el estado de conciliación. */
  sourceExternalId?: string | null;
}

/* ── Estado de conciliación del motor ────────────────────────────────────────
 * Lo entrega `POST /api/treasury/reconciliation/document-resolution/statuses` por
 * documento: `reconciled` = tiene movimiento bancario asignado y saldo 0; `partial` =
 * tiene movimiento pero queda saldo; `unreconciled` = no tiene ninguno. El front NO
 * infiere nada por monto y fecha: eso lo decide el motor. */

export type EstadoConciliacion = "reconciled" | "partial" | "unreconciled";

/** `sourceExternalId` → estado del motor. Un documento ausente del mapa no se oculta. */
export type ConciliacionMap = Record<string, EstadoConciliacion>;

/* ── Fechas ────────────────────────────────────────────────────────────────── */

/** Parsea una fecha del SII ("DD/MM/YYYY") o ISO ("YYYY-MM-DD") a Date (local, sin
 *  hora). `null` si no se reconoce. PURO. */
export function parseSiiDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) return mkDate(+m[3]!, +m[2]!, +m[1]!);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ISO YYYY-MM-DD (ignora la hora)
  if (m) return mkDate(+m[1]!, +m[2]!, +m[3]!);
  return null;
}

/** Construye una Date local a medianoche; `null` si los componentes no forman una
 *  fecha real (ej. 31/02). */
function mkDate(y: number, month: number, day: number): Date | null {
  const d = new Date(y, month - 1, day);
  return d.getFullYear() === y && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** Fecha + N días (calendario, DST-safe: deja que JS normalice). PURO. */
export function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/** Días de calendario entre `from` y `to` (to − from). Positivo = `to` en el futuro. */
export function daysBetween(from: Date, to: Date): number {
  const MS = 86_400_000;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / MS);
}

export type EstadoDoc = "vigente" | "por_vencer" | "vencido" | "sin_fecha";

/** Estado de un documento respecto a HOY. `por_vencer` = vence dentro de `umbral`
 *  días (default 7). Sin fecha de emisión parseable → "sin_fecha". PURO. */
export function estadoDoc(vencimiento: Date | null, today: Date, umbralPorVencer = 7): EstadoDoc {
  if (!vencimiento) return "sin_fecha";
  const dias = daysBetween(today, vencimiento);
  if (dias < 0) return "vencido";
  if (dias <= umbralPorVencer) return "por_vencer";
  return "vigente";
}

/* ── Prefs: términos por tipo + override por contraparte ──────────────────────
 * Clave única `terminos_pago` en el blob de prefs (#571, "reemplaza no mergea").
 * Estructura: { ventas|compras|honorarios: { default: number, byRut: {rut: days} } }. */

export const TERMINOS_KEY = "terminos_pago";

export interface TerminosDomain {
  /** Término default del tipo (días). */
  default: number;
  /** Override por RUT normalizado (días). */
  byRut: Record<string, number>;
}
export type TerminosResueltos = Record<MaestroKind, TerminosDomain>;

const KINDS: MaestroKind[] = ["ventas", "compras", "honorarios"];

/** Lee los términos del blob, rellenando defaults y descartando basura. Defensivo:
 *  el blob es `unknown`. PURO. */
export function readTerminos(blob: PreferencesBlob | undefined): TerminosResueltos {
  const raw = (blob?.[TERMINOS_KEY] ?? {}) as Record<string, unknown>;
  const out = {} as TerminosResueltos;
  for (const kind of KINDS) {
    const dom = (raw?.[kind] ?? {}) as Record<string, unknown>;
    const def = toPositiveInt(dom.default, TERMINO_DEFAULT[kind]);
    const byRut: Record<string, number> = {};
    const rawByRut = (dom.byRut ?? {}) as Record<string, unknown>;
    if (rawByRut && typeof rawByRut === "object" && !Array.isArray(rawByRut)) {
      for (const [rut, v] of Object.entries(rawByRut)) {
        const days = toPositiveInt(v, NaN);
        if (Number.isFinite(days)) byRut[normalizeRut(rut)] = days;
      }
    }
    out[kind] = { default: def, byRut };
  }
  return out;
}

function toPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

/** Término efectivo para una contraparte: su override o el default del tipo. PURO. */
export function termFor(terminos: TerminosResueltos, kind: MaestroKind, rut: string): number {
  const dom = terminos[kind];
  const override = dom.byRut[normalizeRut(rut)];
  return Number.isFinite(override) ? (override as number) : dom.default;
}

/** ¿El término de esta contraparte está personalizado (≠ default del tipo)? */
export function isTermCustom(terminos: TerminosResueltos, kind: MaestroKind, rut: string): boolean {
  return Number.isFinite(terminos[kind].byRut[normalizeRut(rut)]);
}

/** Blob COMPLETO con el override de una contraparte (respeta "reemplaza, no mergea":
 *  preserva el resto de las prefs). PURO. */
export function withTerm(
  blob: PreferencesBlob | undefined,
  kind: MaestroKind,
  rut: string,
  days: number,
): PreferencesBlob {
  const cur = readTerminos(blob);
  const next: TerminosResueltos = {
    ...cur,
    [kind]: {
      ...cur[kind],
      byRut: { ...cur[kind].byRut, [normalizeRut(rut)]: Math.max(0, Math.round(days)) },
    },
  };
  return { ...(blob ?? {}), [TERMINOS_KEY]: next };
}

/** Blob COMPLETO quitando el override de una contraparte (vuelve al default). PURO. */
export function withoutTerm(
  blob: PreferencesBlob | undefined,
  kind: MaestroKind,
  rut: string,
): PreferencesBlob {
  const cur = readTerminos(blob);
  const byRut = { ...cur[kind].byRut };
  delete byRut[normalizeRut(rut)];
  const next: TerminosResueltos = { ...cur, [kind]: { ...cur[kind], byRut } };
  return { ...(blob ?? {}), [TERMINOS_KEY]: next };
}

/** Blob COMPLETO cambiando el default de un tipo. PURO. */
export function withDefaultTerm(
  blob: PreferencesBlob | undefined,
  kind: MaestroKind,
  days: number,
): PreferencesBlob {
  const cur = readTerminos(blob);
  const next: TerminosResueltos = {
    ...cur,
    [kind]: { ...cur[kind], default: Math.max(0, Math.round(days)) },
  };
  return { ...(blob ?? {}), [TERMINOS_KEY]: next };
}

/* ── Declaraciones heredadas "marqué esto pagado" — SOLO LECTURA ───────────────
 * Histórico: cuando no había estado por documento, el maestro dejaba marcar a mano un
 * documento como pagado y lo guardaba en el blob de prefs DEL USUARIO (`docs_pagados`,
 * #571). Esa marca no es una conciliación: es por usuario, no tiene movimiento bancario
 * detrás y la fecha guardada es el día del clic, no la del pago.
 *
 * Hoy el estado lo da el motor (`ConciliacionMap`), así que ya NO se escriben marcas
 * nuevas: `withPagado`/`withoutPagado` se eliminaron a propósito. Las marcas existentes
 * se siguen LEYENDO para mostrarlas como lo que son (una declaración con su fecha) y
 * NO mueven plata. Mapa `docKey → fecha ISO`. */

export const PAGADOS_KEY = "docs_pagados";

/** rut normalizado → fecha ISO en que se marcó pagado. */
export type PagadosMap = Record<string, string>;

/** Clave estable de un documento: tipo + rut + folio (folio solo es único por emisor). */
export function docKey(
  kind: MaestroKind,
  rut: string,
  folio: number | string | null | undefined,
): string {
  return `${kind}:${normalizeRut(rut)}:${folio ?? ""}`;
}

/** Lee el mapa de pagados del blob. Defensivo (blob es `unknown`). PURO. */
export function readPagados(blob: PreferencesBlob | undefined): PagadosMap {
  const v = blob?.[PAGADOS_KEY];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: PagadosMap = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

/** ¿Este documento está marcado pagado? */
export function isPagado(
  map: PagadosMap,
  kind: MaestroKind,
  rut: string,
  folio: number | string | null | undefined,
): boolean {
  return typeof map[docKey(kind, rut, folio)] === "string";
}

/** Fecha ISO en que el usuario declaró este documento pagado, o `null` si nunca lo declaró.
 *  Es una declaración sin movimiento bancario detrás: se muestra, no se contabiliza. PURO. */
export function declaradoPagadoEl(
  map: PagadosMap,
  kind: MaestroKind,
  rut: string,
  folio: number | string | null | undefined,
): string | null {
  return map[docKey(kind, rut, folio)] ?? null;
}

/* ── Agregación: docs → maestro por contraparte ───────────────────────────────*/

export interface DocMaestro {
  folio: number | string | null;
  fecha: string;
  fechaEmision: Date | null;
  monto: number;
  vencimiento: Date | null;
  estado: EstadoDoc;
  /** Días para vencer (negativo = días vencido). null si sin fecha. */
  diasParaVencer: number | null;
  /** Marcado pagado/conciliado a mano (fuera del vencido/por vencer). Legacy: sólo cuando el
   *  caller NO pasa `conciliacion`; con el motor cableado esta marca ya no mueve plata. */
  pagado: boolean;
  /** Clave natural del documento en el dominio (`tipo-folio-rut`), si se pudo derivar. */
  sourceExternalId?: string | null;
  /** Estado del motor de conciliación. Ausente/`null` = el motor no se consultó o no devolvió
   *  esta fila: el documento se MUESTRA (nunca se oculta por falta de respuesta). */
  conciliacion?: EstadoConciliacion | null;
  /** Fecha ISO en que algún usuario declaró este documento pagado a mano (sin movimiento
   *  bancario detrás). Se muestra como la declaración que es; no descuenta del saldo. */
  declaradoPagadoEl?: string | null;
  /** Código de tipo de documento del SII (para mostrar Factura/NC/etc.). */
  tipoDoc: number | null;
  /** ¿Es Nota de Crédito? (resta; `monto` viene negativo). */
  esNotaCredito: boolean;
  /** Para una NC: folio de la factura que anula (se muestra "anula N° X"). null si huérfana. */
  refFolio: number | string | null;
  /** Evaluación conservadora del vínculo legacy; nunca equivale a anulación fiscal. */
  associationStatus?: PendingAssociationStatus;
  /** Para una factura con NC vinculadas: si quedó totalmente anulada o parcialmente. */
  anulacion: "anulada" | "parcial" | null;
  /** Neto de la factura tras sus NC (solo cuando `anulacion` != null). */
  neto: number | null;
  /** El receptor RECLAMÓ el documento en el SII → no cuenta (monto $0); el FE pinta una "R". */
  reclamado?: boolean;
  /** La factura fue CEDIDA (factoring, RPETC): la cobra el factor, no la empresa → NO es por-cobrar. */
  cedido?: boolean;
}

export interface ContraparteMaestro {
  rut: string;
  name: string;
  docCount: number;
  total: number;
  /** Suma de documentos vencidos (emisión + término < hoy). */
  vencido: number;
  /** Suma de documentos por vencer (≤ umbral). */
  porVencer: number;
  /** Suma de documentos vigentes. */
  vigente: number;
  /** Suma de documentos marcados pagados (fuera del vencido/por vencer/vigente). Legacy:
   *  queda en 0 cuando el caller pasa `conciliacion`. */
  pagado: number;
  /** Suma de los documentos que alguien declaró pagados a mano y que el motor NO tiene
   *  conciliados. Sigue dentro del saldo: es deuda viva hasta que haya movimiento bancario. */
  declaradoSinEvidencia?: number;
  /** Cuántos documentos de esta contraparte están en esa situación. */
  docsDeclarados?: number;
  /** Término aplicado (días). */
  termino: number;
  /** ¿El término es un override (≠ default)? */
  terminoCustom: boolean;
  /** Vencimiento más próximo aún no vencido (para "próximo a vencer"). */
  proximoVencimiento: Date | null;
  docs: DocMaestro[];
}

/** Construye el maestro por contraparte a partir de los documentos (RCV/BHE ya
 *  adaptados) y los términos. Ordena las contrapartes por vencido desc (a quién
 *  perseguir/pagar primero) y, a igual vencido, por total desc. PURO.
 *
 *  `conciliacion` es OPCIONAL y aditiva. Sin ella, el comportamiento es el histórico
 *  (las marcas de `pagados` descuentan). Con ella:
 *   - un documento que el motor tiene `reconciled` NO aparece (y si es una factura, se van
 *     también sus notas de crédito vinculadas: la pareja está saldada);
 *   - una contraparte sin documentos restantes desaparece de la lista;
 *   - las marcas manuales de `pagados` dejan de mover plata y quedan como anotación. */
export function buildMaestro(
  docs: ReadonlyArray<DocConVencimiento>,
  terminos: TerminosResueltos,
  kind: MaestroKind,
  today: Date,
  pagados: PagadosMap = {},
  conciliacion?: ConciliacionMap,
): ContraparteMaestro[] {
  const conMotor = conciliacion !== undefined;
  // Agrupar los documentos por contraparte.
  const byRut = new Map<string, DocConVencimiento[]>();
  for (const d of docs) {
    const rut = normalizeRut(String(d.rut ?? ""));
    if (!rut) continue;
    const arr = byRut.get(rut);
    if (arr) arr.push(d);
    else byRut.set(rut, [d]);
  }

  const list: ContraparteMaestro[] = [];
  for (const [rut, cpDocs] of byRut) {
    const termino = termFor(terminos, kind, rut);
    const name = cpDocs.find((d) => d.name)?.name || rut;

    // Vincular NC ↔ factura por la referencia del DTE (reusa la lógica del Libro):
    // cada factura conoce las NC que la modifican; las NC sin factura quedan "huérfanas".
    const grouped = agruparConReferencias(
      cpDocs.map((d) => ({
        tipo_doc: d.tipoDoc,
        folio: typeof d.folio === "number" ? d.folio : undefined,
        fecha: d.fecha,
        monto_total: Math.abs(Number.isFinite(d.monto) ? d.monto : 0),
        rut_contraparte: rut,
        ref_folio: d.refFolio,
        ref_tipo_doc: d.refTipoDoc,
        reclamado: d.reclamado === true, // se preserva en la fila agrupada (genérico) → DocMaestro
        cedido: d.cedido === true, // cedida (factoring) → se preserva para excluirla del por-cobrar
        source_external_id: d.sourceExternalId ?? null, // pasa intacto por el agrupador genérico
      })),
    );

    /** Estado del motor para una fila agrupada. `null` si no se consultó o no vino. */
    const estadoMotor = (row: {
      source_external_id?: string | null;
    }): EstadoConciliacion | null => {
      if (!conciliacion) return null;
      const key = row.source_external_id;
      return key ? (conciliacion[key] ?? null) : null;
    };

    const docsOut: DocMaestro[] = [];
    let total = 0,
      vencido = 0,
      porVencer = 0,
      vigente = 0,
      pagadoSum = 0,
      declaradoSinEvidencia = 0,
      docsDeclarados = 0;
    // Exceso de NC VINCULADAS que sobre-acreditan su factura (neto < 0): como el bucket de esa
    // factura se pisa en 0, ese crédito sobrante debe restarse de OTRAS facturas (igual que una NC
    // huérfana). Si no, quedaría vencido > saldo. Se acumula acá y entra al re-balance de abajo.
    let excesoVinculado = 0;
    let proximo: Date | null = null;

    // Facturas de MÁS NUEVA a más antigua; cada una seguida de sus NC vinculadas (así
    // se lee que una anula a la otra).
    const rowsSorted = [...grouped.rows].sort((a, b) =>
      sortByEmisionDesc(parseSiiDate(a.factura.fecha), parseSiiDate(b.factura.fecha)),
    );
    for (const row of rowsSorted) {
      const f = row.factura;
      const estadoRec = estadoMotor(f);
      // Requisito del dueño: conciliado de verdad = no aparece. Se va la factura y con ella sus
      // NC vinculadas (dejar la NC sola la volvería huérfana y restaría de otras facturas).
      if (estadoRec === "reconciled") continue;
      const fFolio = f.folio ?? null;
      const em = parseSiiDate(f.fecha);
      const venc = em ? addDays(em, termino) : null;
      const estado = estadoDoc(venc, today);
      const declaradoEl = declaradoPagadoEl(pagados, kind, rut, fFolio);
      // Con el motor cableado la declaración manual no descuenta: sólo se anota.
      const pagadoF = conMotor ? false : isPagado(pagados, kind, rut, fFolio);
      const anulacion =
        row.notas.length === 0 ? null : row.estado === "anulada" ? "anulada" : "parcial";
      // Factura RECLAMADA (compras o ventas): rechazada en el SII → NO es una obligación real, no
      // suma $ (decisión de Fernando 2026-08-01). Se muestra igual en el detalle con su "R", igual
      // que el 360 (`montoFirmado` → 0). Antes inflaba total/vencido/por-vencer y contradecía al 360.
      // Factura CEDIDA (factoring, RPETC, solo ventas): la cobra el factor → NO es por-cobrar de la
      // empresa. Excluirla alinea Cobrar/Caja con el `accounts-receivable` corregido del backend (#804).
      const reclamada = f.reclamado === true;
      const cedida = f.cedido === true;
      const excluida = reclamada || cedida;

      if (!excluida) {
        total += row.neto; // neto de la factura tras sus NC (puede ser ≤ 0)
        if (pagadoF) {
          pagadoSum += row.neto;
        } else {
          const contrib = Math.max(0, row.neto); // sobre-crédito → 0 en buckets
          if (estado === "vencido") vencido += contrib;
          else if (estado === "por_vencer") porVencer += contrib;
          else if (estado === "vigente") vigente += contrib;
          if (row.neto < 0) excesoVinculado += -row.neto; // sobre-crédito → al pool de re-balance
          // Solo cuenta como "próximo a vencer" si queda saldo real (neto > 0): una factura
          // anulada al 100% / sobre-acreditada (neto ≤ 0) no es una obligación futura.
          if (venc && estado !== "vencido" && row.neto > 0) {
            if (!proximo || venc < proximo) proximo = venc;
          }
          if (conMotor && declaradoEl) {
            declaradoSinEvidencia += Math.max(0, row.neto);
            docsDeclarados += 1;
          }
        }
      }

      docsOut.push({
        folio: fFolio,
        fecha: f.fecha ?? "",
        fechaEmision: em,
        monto: Math.abs(Number.isFinite(f.monto_total) ? f.monto_total : 0),
        vencimiento: venc,
        estado,
        diasParaVencer: venc ? daysBetween(today, venc) : null,
        pagado: pagadoF,
        tipoDoc: f.tipo_doc ?? null,
        esNotaCredito: false,
        refFolio: null,
        anulacion,
        neto: anulacion ? row.neto : null,
        reclamado: f.reclamado === true,
        cedido: f.cedido === true,
        sourceExternalId: f.source_external_id ?? null,
        conciliacion: estadoRec,
        declaradoPagadoEl: declaradoEl,
      });
      for (const nc of row.notas) {
        const emN = parseSiiDate(nc.fecha);
        const vN = emN ? addDays(emN, termino) : null;
        docsOut.push({
          folio: nc.folio ?? null,
          fecha: nc.fecha ?? "",
          fechaEmision: emN,
          monto: -Math.abs(Number.isFinite(nc.monto_total) ? nc.monto_total : 0),
          vencimiento: vN,
          estado: estadoDoc(vN, today),
          diasParaVencer: null,
          pagado: false,
          tipoDoc: nc.tipo_doc ?? null,
          esNotaCredito: true,
          refFolio: fFolio,
          anulacion: null,
          neto: null,
          sourceExternalId: nc.source_external_id ?? null,
          conciliacion: estadoMotor(nc),
          declaradoPagadoEl: null,
        });
      }
    }

    // NC sin efecto documental confirmado: restan del total general porque son DTE reales,
    // pero no se asignan a una factura ni a un bucket de vencimiento. El contrato legacy no
    // trae CodRef/fecha/procedencia suficientes y repartirlas desde el front alteraría mora y
    // prioridades por una heurística. Se muestran al final del detalle.
    for (const nc of grouped.notasHuerfanas) {
      if (estadoMotor(nc) === "reconciled") continue;
      const pendingAssociation = grouped.asociacionesPendientes.find(
        (association) => association.nota === nc,
      );
      const mnc = Math.abs(Number.isFinite(nc.monto_total) ? nc.monto_total : 0);
      total -= mnc;
      const emN = parseSiiDate(nc.fecha);
      const vN = emN ? addDays(emN, termino) : null;
      docsOut.push({
        folio: nc.folio ?? null,
        fecha: nc.fecha ?? "",
        fechaEmision: emN,
        monto: -mnc,
        vencimiento: vN,
        estado: estadoDoc(vN, today),
        diasParaVencer: null,
        pagado: false,
        tipoDoc: nc.tipo_doc ?? null,
        esNotaCredito: true,
        refFolio: null,
        associationStatus: pendingAssociation?.status ?? "unresolved",
        anulacion: null,
        neto: null,
        sourceExternalId: nc.source_external_id ?? null,
        conciliacion: estadoMotor(nc),
        declaradoPagadoEl: null,
      });
    }
    // Contraparte sin documentos pendientes → se va de la lista (requisito 1 del dueño).
    if (conMotor && docsOut.length === 0) continue;
    let r = excesoVinculado;
    const tv = Math.min(r, vencido);
    vencido -= tv;
    r -= tv;
    const tp = Math.min(r, porVencer);
    porVencer -= tp;
    r -= tp;
    const tg = Math.min(r, vigente);
    vigente -= tg;

    list.push({
      rut,
      name,
      docCount: conMotor ? docsOut.length : cpDocs.length,
      total,
      vencido,
      porVencer,
      vigente,
      pagado: pagadoSum,
      declaradoSinEvidencia,
      docsDeclarados,
      termino,
      terminoCustom: isTermCustom(terminos, kind, rut),
      proximoVencimiento: proximo,
      docs: docsOut,
    });
  }

  // Contrapartes: primero las de más vencido; a igual vencido, mayor total.
  list.sort((a, b) => b.vencido - a.vencido || b.total - a.total);
  return list;
}

/** Ordena por fecha de emisión DESC (más nuevo primero); sin fecha, al final. */
function sortByEmisionDesc(a: Date | null, b: Date | null): number {
  if (a && b) return b.getTime() - a.getTime();
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** Totales del maestro completo (para el hero/resumen). PURO. */
export function totalesMaestro(cps: ReadonlyArray<ContraparteMaestro>) {
  return cps.reduce(
    (acc, c) => ({
      total: acc.total + c.total,
      vencido: acc.vencido + c.vencido,
      porVencer: acc.porVencer + c.porVencer,
      vigente: acc.vigente + c.vigente,
      pagado: acc.pagado + c.pagado,
      declaradoSinEvidencia: acc.declaradoSinEvidencia + (c.declaradoSinEvidencia ?? 0),
      docsDeclarados: acc.docsDeclarados + (c.docsDeclarados ?? 0),
      contrapartes: acc.contrapartes + 1,
      docs: acc.docs + c.docCount,
    }),
    {
      total: 0,
      vencido: 0,
      porVencer: 0,
      vigente: 0,
      pagado: 0,
      declaradoSinEvidencia: 0,
      docsDeclarados: 0,
      contrapartes: 0,
      docs: 0,
    },
  );
}
