/* V12 · Administración — el modelo PURO del hub (rediseño Fase 2, issue #75).
 *
 * Contesta UNA pregunta: "¿cómo configuro mi equipo y mis fuentes, y qué necesita mi atención?".
 *
 * Sin React a propósito, como `pagar-v05-model.ts` / `gestion-v08-model.ts`: cada estado de fila
 * de este hub es una afirmación sobre el negocio (¿hay algo vencido?, ¿cuántas empresas?) que se
 * fija en un test sin montar un DOM.
 *
 * FUENTE de la fila Credenciales — Ley 1, MISMA función que V11: `sourceToConnectionCopy` sobre
 * `GET /api/sources/status` (`src/components/conexiones/conexiones-copy.ts`). No se reimplementa
 * el criterio de "qué requiere acción del dueño"; si V11 cambia esa clasificación, este hub la
 * hereda gratis en vez de arriesgarse a divergir (el bug exacto que la Ley 1 previene).
 *
 * FUENTES de Empresas y Usuarios: `GET /api/me/tenants` (`tenants.length`) y `GET /api/users`
 * (`total`) — los mismos endpoints que ya alimentan el selector de empresas y la tabla de
 * usuarios, VIVOS en prod.
 *
 * HUECO DECLARADO (no se rellena, se dice): las filas Estructura de gestión, Vistas de gestión,
 * Monedas, Plantillas y MCP no llevan estado calculado en este PR · cada
 * una vive detrás de su propio flag (`managementAccounts`, `managementDimensions`,
 * `classificationRules`, `mcp`) y no hay todavía una señal barata y honesta que resuma su estado
 * sin una consulta adicional por fila. Se declara acá y en el PR; el sucesor las completa fila por
 * fila. Reglas sí consume el contrato verificable de qavante-api#439: las aplicaciones se
 * atribuyen por id estable y las correcciones son acciones automáticas deshechas. */

import type { SourceStatus } from "@/lib/api/sources-status";
import { visibleSources } from "@/lib/api/sources-status";
import { sourceToConnectionCopy } from "@/components/conexiones/conexiones-copy";
import { concordar, formatCount } from "@/lib/formatters/count";

export type TonoEstadoV12 = "ok" | "warn" | "neutral" | "bad";

export interface EstadoFilaV12 {
  tono: TonoEstadoV12;
  texto: string;
}

export interface FilaHubV12 {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  /** `null` = sin estado calculado (hueco declarado arriba), no un estado "vacío" disfrazado. */
  estado: EstadoFilaV12 | null;
}

/** Estado de UNA consulta en vuelo, para las tres filas que SÍ calculan estado (Credenciales,
 *  Empresas, Usuarios) — Ley 8: "cargando" y "error" son estados que hablan, no la misma celda en
 *  blanco que las filas con hueco declarado. `"listo"` es la ÚNICA rama con dato real; las otras
 *  dos NO llevan `valor` porque no hay ninguno que mostrar todavía. */
export type CargaV12<T> = { tipo: "cargando" } | { tipo: "error" } | { tipo: "listo"; valor: T };

/** Credenciales: Ley 1, misma fuente que V11. `cargando`/`error` traen su PROPIO estado (nunca
 *  `null`, que es el hueco declarado de las otras filas). `[]` (cero fuentes visibles) tampoco
 *  afirma nada: no hay ninguna fuente que pueda requerir acción, así que es "Al día" de verdad. */
export function estadoCredenciales(carga: CargaV12<SourceStatus[]>): EstadoFilaV12 | null {
  if (carga.tipo === "cargando") return { tono: "neutral", texto: "Cargando credenciales…" };
  if (carga.tipo === "error") return { tono: "bad", texto: "No se pudo cargar" };
  const visibles = visibleSources(carga.valor);
  const conAccion = visibles.filter((s) => sourceToConnectionCopy(s).requiresOwnerAction).length;
  if (conAccion === 0) return { tono: "ok", texto: "Al día" };
  return {
    tono: "warn",
    texto: `${formatCount(conAccion)} ${concordar(conAccion, "requiere", "requieren")} tu acción → Renovar`,
  };
}

export function estadoEmpresas(carga: CargaV12<number>): EstadoFilaV12 | null {
  if (carga.tipo === "cargando") return { tono: "neutral", texto: "Cargando empresas…" };
  if (carga.tipo === "error") return { tono: "bad", texto: "No se pudo cargar" };
  const n = carga.valor;
  return { tono: "neutral", texto: `${formatCount(n)} ${concordar(n, "empresa", "empresas")}` };
}

export function estadoUsuarios(carga: CargaV12<number>): EstadoFilaV12 | null {
  if (carga.tipo === "cargando") return { tono: "neutral", texto: "Cargando usuarios…" };
  if (carga.tipo === "error") return { tono: "bad", texto: "No se pudo cargar" };
  const n = carga.valor;
  return { tono: "neutral", texto: `${formatCount(n)} ${concordar(n, "usuario", "usuarios")}` };
}

export interface ResumenReglasV12 {
  activas: number;
  aplicaciones: number;
  correcciones: number;
  medidas: number;
  sinMedicion: number;
}

export interface UsoReglaV12 {
  coverage: "complete_since_tracking_started_at" | "unknown";
  application_count?: number | null;
  correction_count?: number | null;
}

type UsoReglaMedidoV12 = UsoReglaV12 & {
  application_count: number;
  correction_count: number;
};

function esUsoMedido(uso: UsoReglaV12): uso is UsoReglaMedidoV12 {
  return (
    uso.coverage === "complete_since_tracking_started_at" &&
    uso.application_count != null &&
    uso.correction_count != null
  );
}

/** Agrega sólo reglas con cobertura completa. Las reglas sin trazabilidad conservan un contador
 * separado; no entran como ceros en aplicaciones/correcciones. */
export function resumenReglas(
  reglas: ReadonlyArray<{ active: boolean }>,
  usos: ReadonlyArray<UsoReglaV12>,
): ResumenReglasV12 {
  const medidos = usos.filter(esUsoMedido);
  return {
    activas: reglas.filter((regla) => regla.active).length,
    aplicaciones: medidos.reduce((total, uso) => total + uso.application_count, 0),
    correcciones: medidos.reduce((total, uso) => total + uso.correction_count, 0),
    medidas: medidos.length,
    sinMedicion: usos.length - medidos.length,
  };
}

export function estadoReglas(carga: CargaV12<ResumenReglasV12>): EstadoFilaV12 | null {
  if (carga.tipo === "cargando") return { tono: "neutral", texto: "Midiendo uso de reglas…" };
  if (carga.tipo === "error") return { tono: "bad", texto: "No se pudo medir el uso" };
  const { activas, aplicaciones, correcciones, medidas, sinMedicion } = carga.valor;
  if (medidas === 0 && sinMedicion > 0) {
    return {
      tono: "neutral",
      texto: `${formatCount(activas)} ${concordar(activas, "regla activa", "reglas activas")} · uso sin dato en ${formatCount(sinMedicion)} ${concordar(sinMedicion, "regla", "reglas")}`,
    };
  }
  const cobertura =
    sinMedicion > 0
      ? ` · ${formatCount(sinMedicion)} ${concordar(sinMedicion, "regla sin medición", "reglas sin medición")}`
      : "";
  return {
    tono: "neutral",
    texto: `${formatCount(activas)} ${concordar(activas, "regla activa", "reglas activas")} · ${formatCount(aplicaciones)} ${concordar(aplicaciones, "aplicación", "aplicaciones")} y ${formatCount(correcciones)} ${concordar(correcciones, "corrección", "correcciones")} en ${formatCount(medidas)} ${concordar(medidas, "regla medida", "reglas medidas")}${cobertura}`,
  };
}

export interface HubInputsV12 {
  /** Estado de `/api/sources/status` — cargando/error/listo, nunca colapsado a `null`. */
  sources: CargaV12<SourceStatus[]>;
  /** Estado de `/api/me/tenants`. */
  empresas: CargaV12<number>;
  /** Estado de `/api/users`. */
  usuarios: CargaV12<number>;
  /** Conteos verificables desde el comienzo de cobertura que publica cada regla. */
  reglas: CargaV12<ResumenReglasV12>;
  /** Flag `mcp` (ADR-0092): sólo se ofrece la fila cuando la funcionalidad existe. */
  mcpVisible: boolean;
}

/** Las 8 (o 9, con MCP) filas del hub, en el mismo orden que la grilla de tarjetas actual —
 *  cambiar el orden sin avisar sería mover algo que el dueño ya memorizó. PURO: no decide nada
 *  sobre loading/error de las filas SIN estado calculado (esas siempre muestran su descripción). */
export function filasHubV12(inputs: HubInputsV12): FilaHubV12[] {
  const filas: FilaHubV12[] = [
    {
      id: "empresas",
      titulo: "Empresas",
      descripcion: "Las empresas de tu cuenta: cambia entre ellas o agrega una nueva.",
      href: "/administracion/empresas",
      estado: estadoEmpresas(inputs.empresas),
    },
    {
      id: "usuarios",
      titulo: "Usuarios",
      descripcion: "Invita, suspende y cambia roles del equipo que accede a tu Qavante.",
      href: "/administracion/usuarios",
      estado: estadoUsuarios(inputs.usuarios),
    },
    {
      id: "credenciales",
      titulo: "Credenciales",
      descripcion: "Claves del SII, certificado digital y conexión con tu banco.",
      href: "/administracion/credenciales",
      estado: estadoCredenciales(inputs.sources),
    },
    {
      id: "estructura-gestion",
      titulo: "Estructura de gestión",
      descripcion:
        "Ordena tus ingresos, costos, gastos, caja y obligaciones, partiendo de una base sugerida.",
      href: "/administracion/estructura-gestion",
      estado: null,
    },
    {
      id: "vistas-gestion",
      titulo: "Vistas de gestión",
      descripcion:
        "Mira tu negocio por cliente, proyecto, obra, local, sociedad, canal u otra variable.",
      href: "/administracion/vistas-gestion",
      estado: null,
    },
    {
      id: "monedas",
      titulo: "Monedas",
      descripcion: "Moneda principal de tu empresa y monedas en que quieres ver tus reportes.",
      href: "/administracion/monedas",
      estado: null,
    },
    {
      id: "reglas-clasificacion",
      titulo: "Reglas de clasificación",
      descripcion: "Reglas que Qavante usa para clasificar movimientos similares en el futuro.",
      href: "/administracion/reglas-clasificacion",
      estado: estadoReglas(inputs.reglas),
    },
    {
      id: "plantillas",
      titulo: "Plantillas por rubro",
      descripcion: "Estructura sugerida de cuentas y vistas según el tipo de negocio que tengas.",
      href: "/administracion/plantillas",
      estado: null,
    },
  ];
  if (inputs.mcpVisible) {
    filas.push({
      id: "mcp",
      titulo: "Conectar un asistente (MCP)",
      descripcion:
        "Deja que ChatGPT o Claude lean tus datos de Qavante para responderte, con una API-key que controlas.",
      href: "/administracion/mcp",
      estado: null,
    });
  }
  return filas;
}
