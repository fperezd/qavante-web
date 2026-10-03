import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  connectionActionError,
  connectionsLoadError,
  type AccionConexion,
} from "./bancos-conectados-copy";

/** Lo que no puede salir a pantalla: ausencia o sorpresa en vez de estado y acción. */
const PROHIBIDO = /inesperad|no disponible|sin dato|no hay dato|preliminar|estimad/i;
/** Una acción concreta: el dueño tiene que saber qué hacer después de leer. */
const ACCION =
  /reintentar|intenta|inicia sesión|pide|pídesela|revisa|verifica|elige|consulta|repite|contacta|espera/i;

const ACCIONES: AccionConexion[] = ["desconectar", "eliminar"];

const CASOS: Array<[string, unknown]> = [
  ["401", new ApiError("Unauthorized", 401)],
  ["403", new ApiError("Forbidden", 403)],
  ["404", new ApiError("Not Found", 404)],
  ["409", new ApiError("conflict", 409, "conflict")],
  ["422", new ApiError("Unprocessable", 422)],
  ["429", new ApiError("Too Many Requests", 429)],
  ["500", new ApiError("Internal Server Error", 500)],
  ["503", new ApiError("Service Unavailable", 503)],
  ["red (status 0)", new ApiError("fetch failed", 0)],
  ["network_error", new ApiError("fetch failed", 0, "network_error")],
  ["fintoc_attribution_unverified", new ApiError("x", 422, "fintoc_attribution_unverified")],
  ["fintoc_holder_mismatch", new ApiError("x", 422, "fintoc_holder_mismatch")],
  ["fintoc_link_missing", new ApiError("x", 422, "fintoc_link_missing")],
  ["fintoc_permissions_missing", new ApiError("x", 403, "fintoc_permissions_missing")],
  ["fintoc_not_configured", new ApiError("x", 503, "fintoc_not_configured")],
  ["Error pelado", new Error("TypeError: Failed to fetch")],
  ["algo que no es Error", { nope: true }],
  ["undefined", undefined],
];

describe("connectionsLoadError", () => {
  it.each(CASOS)("%s: dice qué pasó y qué hacer, sin copy prohibido", (_nombre, error) => {
    const message = connectionsLoadError(error);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(PROHIBIDO);
    expect(message).toMatch(ACCION);
  });

  it("nunca filtra el mensaje de transporte del servidor", () => {
    const error = new ApiError("psycopg2.OperationalError: connection refused", 500);
    expect(connectionsLoadError(error)).not.toContain("psycopg2");
  });

  it("traduce los códigos fintoc por el mapper canónico, no por el message crudo", () => {
    const error = new ApiError("holder mismatch", 422, "fintoc_holder_mismatch");
    const message = connectionsLoadError(error);
    expect(message).toContain("RUT titular");
    expect(message).not.toContain("holder mismatch");
  });

  it("401 manda a iniciar sesión; 403 manda a pedir acceso", () => {
    expect(connectionsLoadError(new ApiError("", 401))).toContain("Inicia sesión");
    expect(connectionsLoadError(new ApiError("", 403))).toContain("Pide acceso");
  });
});

describe("connectionActionError", () => {
  it.each(
    ACCIONES.flatMap((accion) => CASOS.map(([nombre, error]) => [accion, nombre, error] as const)),
  )("%s / %s: declara en qué quedó la conexión y qué hacer", (accion, _nombre, error) => {
    const message = connectionActionError(error, accion);
    expect(message).not.toMatch(PROHIBIDO);
    expect(message).toMatch(ACCION);
    // La primera frase es el estado: la acción NO tuvo efecto. Salvo en 404, donde el
    // servidor acaba de negar que la conexión exista: ahí afirmarlo sería mentir.
    const es404 = error instanceof ApiError && error.status === 404;
    expect(message).toMatch(
      es404
        ? /^Esta conexión ya no está en Qavante/
        : accion === "desconectar"
          ? /^El banco sigue conectado/
          : /^El banco y su historial siguen/,
    );
  });

  it("desconectar y eliminar no dicen lo mismo sobre el historial", () => {
    const error = new ApiError("boom", 500);
    expect(connectionActionError(error, "desconectar")).not.toBe(
      connectionActionError(error, "eliminar"),
    );
    expect(connectionActionError(error, "eliminar")).toContain("historial");
  });

  it("no filtra el mensaje de transporte del servidor", () => {
    const error = new ApiError("asyncpg.exceptions.ForeignKeyViolationError", 409);
    expect(connectionActionError(error, "eliminar")).not.toContain("asyncpg");
  });
});

describe("la cola genérica del mapper canónico no se filtra", () => {
  /* `apiErrorToUserMessage` devuelve "Ocurrió un error inesperado" para un status sin mapear.
     Este test fija que este módulo no la reexporta: si alguien reemplaza la escalera por una
     delegación directa, el test cae. */
  it.each([409, 418, 451, 520])("status %s no dice 'inesperado'", (status) => {
    const error = new ApiError("boom", status);
    expect(connectionsLoadError(error)).not.toMatch(/inesperad/i);
    expect(connectionActionError(error, "desconectar")).not.toMatch(/inesperad/i);
    expect(connectionActionError(error, "eliminar")).not.toMatch(/inesperad/i);
  });

  it("un código fintoc nuevo en el mapper se usa sin tocar este archivo", () => {
    const error = new ApiError("x", 422, "fintoc_attribution_unverified");
    expect(connectionsLoadError(error)).toContain("Administración → Empresas");
  });

  it("404 al actuar no afirma que el banco siga conectado", () => {
    const message = connectionActionError(new ApiError("", 404), "desconectar");
    expect(message).not.toContain("sigue conectado");
    expect(message).toContain("Reintentar");
  });
});
