import type { SourceStatus } from "@/lib/api/sources-status";
import type { FilaHubV12 } from "./administracion-v12-model";

/* Fixtures del hub V12 — para stories y tests de la vista. Los datos deliberadamente incluyen UNA
 * fuente en `missing` (Ley 1: la misma forma que dispara "N requiere tu acción" en V11) para que
 * la story y el test de N=1 no dependan de armar el estado a mano en cada sitio. */

export const FUENTES_AL_DIA: SourceStatus[] = [
  {
    source: "sii_rcv",
    display_name: "SII",
    state: "ok",
    reason: null,
    last_sync: "2026-08-29T10:00:00Z",
  },
  {
    source: "bank_bice",
    display_name: "Banco BICE",
    state: "ok",
    reason: null,
    last_sync: "2026-08-30T06:00:00Z",
  },
];

export const FUENTES_CON_UNA_VENCIDA: SourceStatus[] = [
  ...FUENTES_AL_DIA,
  {
    source: "buk",
    display_name: "Remuneraciones (BUK)",
    state: "missing",
    reason: "upstream: no_session: token vencido",
    last_sync: "2026-07-15T09:00:00Z",
  },
];

export const FILAS_HUB_EJEMPLO: FilaHubV12[] = [
  {
    id: "empresas",
    titulo: "Empresas",
    descripcion: "Las empresas de tu cuenta: cambia entre ellas o agrega una nueva.",
    href: "/administracion/empresas",
    estado: { tono: "neutral", texto: "2 empresas" },
  },
  {
    id: "usuarios",
    titulo: "Usuarios",
    descripcion: "Invita, suspende y cambia roles del equipo que accede a tu Qavante.",
    href: "/administracion/usuarios",
    estado: { tono: "neutral", texto: "4 usuarios" },
  },
  {
    id: "credenciales",
    titulo: "Credenciales",
    descripcion: "Claves del SII, certificado digital y conexión con tu banco.",
    href: "/administracion/credenciales",
    estado: { tono: "warn", texto: "1 requiere tu acción → Renovar" },
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
    estado: null,
  },
  {
    id: "plantillas",
    titulo: "Plantillas por rubro",
    descripcion: "Estructura sugerida de cuentas y vistas según el tipo de negocio que tengas.",
    href: "/administracion/plantillas",
    estado: null,
  },
];
