import fs from "node:fs";
import path from "node:path";
import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Request,
  type Response,
  type Route,
  type TestInfo,
} from "@playwright/test";
import {
  ACTIVE_COMPANY_STORAGE_KEY,
  API_HOST,
  API_URL,
  APP_HOST,
  APP_URL,
  AUTORIZA_PROYECCION,
  COMPANY_HEADER,
  LEGAL_ENTITY_ID,
  SESSION,
} from "./env";

/* Fixtures del QA de producción. NO es un spec.

   1. Sesión: la cookie `qavante_session` se inyecta con `context.addCookies` para el host de la app
      y el de la API. Nunca se imprime ni se escribe en la evidencia.
   2. Guardia de solo lectura: toda request no-GET hacia la app o la API se ABORTA y el test FALLA,
      salvo una excepción documentada (POST /api/treasury/cash-projection-runs, ver
      `esProyeccionPermitida`). A otros hosts (analítica) se abortan sin fallar.
   3. Evidencia: cada respuesta /api queda en `test-results/qa-produccion/<ID>/api.json` (método, url,
      status, headers sin cookies, body truncado a ~200 KB) más un screenshot de página completa, y
      ambos se adjuntan con `testInfo.attach`. */

const RAIZ_EVIDENCIA = path.resolve("test-results", "qa-produccion");
const MAX_BODY = 200_000;
const HEADERS_SENSIBLES =
  /^(cookie|set-cookie|authorization|proxy-authorization|x-csrf-token|x-xsrf-token)$/i;

export interface ApiCaptura {
  metodo: string;
  url: string;
  status: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  body: string;
  truncado: boolean;
  origen: "pagina" | "qa";
}

export interface Bloqueo {
  metodo: string;
  url: string;
  motivo: string;
}

/** Quita la sesión de cualquier texto que vaya a disco. */
export function redactar(texto: string): string {
  let out = texto;
  for (const secreto of [SESSION, process.env.QAVANTE_SESSION_READONLY ?? ""]) {
    if (secreto && secreto.length >= 8) out = out.split(secreto).join("[REDACTADO]");
  }
  return out.replace(/(qavante_session=)[^;\s"]+/gi, "$1[REDACTADO]");
}

function headersLimpios(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = HEADERS_SENSIBLES.test(k) ? "[REDACTADO]" : redactar(v);
  }
  return out;
}

function recortar(body: string): { body: string; truncado: boolean } {
  const limpio = redactar(body);
  return limpio.length > MAX_BODY
    ? { body: limpio.slice(0, MAX_BODY), truncado: true }
    : { body: limpio, truncado: false };
}

/** ID de la carpeta de evidencia: "B07 — …" → "B07"; si no, el título en slug. */
export function idEvidencia(info: TestInfo): string {
  const m = /^(B\d{2}|(?:INV|SEG|A11Y)-[A-Za-z0-9-]+)(?=\s|$)/.exec(info.title);
  if (m) return m[1]!;
  return info.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Carpeta de evidencia del test (`test-results/qa-produccion/<ID>/`). */
export function dirEvidencia(info: TestInfo): string {
  return path.join(RAIZ_EVIDENCIA, idEvidencia(info));
}

function esApi(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.host === API_HOST || u.host === APP_HOST) && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** Única escritura que la suite puede llegar a dejar pasar, y SÓLO con autorización explícita del
 *  dueño (`QAVANTE_QA_AUTORIZA_PROYECCION=1`): el cálculo de la proyección canónica que la PROPIA
 *  página dispara al cargar Caja, Pagar y Decisiones
 *  (src/lib/api/cash-projection-runs.ts, `useCashProjectionRun`).
 *
 *  POR OMISIÓN ESTÁ BLOQUEADA. El argumento a favor de dejarla pasar es bueno y no alcanza: (1) es
 *  lo que hace cualquier usuario al abrir esas pantallas; (2) devuelve una foto inmutable con
 *  `Idempotency-Key`, sin efectos de negocio (no clasifica, no concilia, no paga, no mueve saldos);
 *  (3) sin ella no se puede observar B01 (el 503 `v14_scope_authority_unavailable`) ni B19 (cómo la
 *  pantalla muestra ese 503), porque abortarla FABRICA el mismo error que se quiere medir. Nada de
 *  eso convierte una escritura en producción en algo que la suite decida sola. Con la variable
 *  puesta, además, se valida que el cuerpo traiga sólo las cuatro llaves del contrato. */
function esProyeccionPermitida(req: Request): boolean {
  if (!AUTORIZA_PROYECCION) return false;
  if (req.method() !== "POST") return false;
  const u = new URL(req.url());
  if (u.host !== API_HOST || u.pathname !== "/api/treasury/cash-projection-runs") return false;
  try {
    const body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
    const permitidas = new Set(["horizon_days", "legal_entity_id", "currency", "as_of"]);
    return Object.keys(body).every((k) => permitidas.has(k));
  } catch {
    return false;
  }
}

async function instalarGuardia(context: BrowserContext, bloqueos: Bloqueo[]): Promise<void> {
  await context.route("**/*", async (route: Route) => {
    const req = route.request();
    const metodo = req.method().toUpperCase();
    if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return route.continue();
    if (esProyeccionPermitida(req)) return route.continue();

    let host = "";
    let ruta = "";
    try {
      const u = new URL(req.url());
      host = u.host;
      ruta = u.pathname;
    } catch {
      /* URL rara: se aborta igual. */
    }
    const propio = host === API_HOST || host === APP_HOST;
    const esServerAction = Boolean((await req.allHeaders())["next-action"]);
    // Analítica del CDN (`/cdn-cgi/…`) y hosts de terceros: se cortan sin fallar el test.
    const relevante = propio && (ruta.startsWith("/api/") || esServerAction);
    if (relevante) {
      bloqueos.push({
        metodo,
        url: redactar(req.url()),
        motivo:
          ruta === "/api/auth/refresh"
            ? "refresh de sesión bloqueado: la cookie expiró; renueva QAVANTE_SESSION"
            : "escritura bloqueada por la guardia de solo lectura",
      });
    }
    return route.abort("blockedbyclient");
  });
}

async function capturarRespuesta(res: Response, origen: ApiCaptura["origen"]): Promise<ApiCaptura> {
  const req = res.request();
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "<sin cuerpo legible>";
  }
  const { body: b, truncado } = recortar(body);
  let reqHeaders: Record<string, string> = {};
  let resHeaders: Record<string, string> = {};
  try {
    reqHeaders = await req.allHeaders();
  } catch {
    reqHeaders = req.headers();
  }
  try {
    resHeaders = await res.allHeaders();
  } catch {
    resHeaders = res.headers();
  }
  return {
    metodo: req.method(),
    url: redactar(res.url()),
    status: res.status(),
    requestHeaders: headersLimpios(reqHeaders),
    responseHeaders: headersLimpios(resHeaders),
    requestBody: req.postData() ? redactar(req.postData()!) : null,
    body: b,
    truncado,
    origen,
  };
}

/** Lo que el test puede consultar de la evidencia. */
export class Evidencia {
  readonly capturas: ApiCaptura[] = [];
  readonly bloqueos: Bloqueo[] = [];
  readonly notas: string[] = [];
  private pendientes: Promise<unknown>[] = [];

  registrar(p: Promise<ApiCaptura>): void {
    this.pendientes.push(p.then((c) => this.capturas.push(c)).catch(() => undefined));
  }

  async listo(): Promise<void> {
    await Promise.all(this.pendientes);
  }

  nota(texto: string): void {
    this.notas.push(texto);
  }

  /** Última respuesta /api cuya ruta (+query) calza con el patrón. */
  async ultima(patron: RegExp, metodo = "GET"): Promise<ApiCaptura | null> {
    await this.listo();
    const hits = this.capturas.filter(
      (c) => c.metodo === metodo && patron.test(new URL(c.url).pathname + new URL(c.url).search),
    );
    return hits.at(-1) ?? null;
  }

  async todas(patron: RegExp, metodo?: string): Promise<ApiCaptura[]> {
    await this.listo();
    return this.capturas.filter(
      (c) =>
        (!metodo || c.metodo === metodo) &&
        patron.test(new URL(c.url).pathname + new URL(c.url).search),
    );
  }
}

export function jsonDe<T = unknown>(c: ApiCaptura | null): T | null {
  if (!c) return null;
  try {
    return JSON.parse(c.body) as T;
  } catch {
    return null;
  }
}

/** Cliente de la API que SÓLO sabe hacer GET (no hay método para escribir). */
export class ApiLectura {
  constructor(
    private readonly request: APIRequestContext,
    private readonly evidencia: Evidencia,
    private readonly companyId: () => string,
  ) {}

  async get<T = unknown>(
    ruta: string,
    opts: { sinEmpresa?: boolean; headers?: Record<string, string> } = {},
  ): Promise<{ status: number; json: T | null; captura: ApiCaptura }> {
    const empresa = opts.sinEmpresa ? "" : this.companyId();
    const res = await this.request.get(`${API_URL}${ruta}`, {
      headers: {
        Accept: "application/json",
        Origin: APP_URL,
        ...(empresa ? { [COMPANY_HEADER]: empresa } : {}),
        ...(opts.headers ?? {}),
      },
      failOnStatusCode: false,
      timeout: 45_000,
    });
    const text = await res.text().catch(() => "");
    const { body, truncado } = recortar(text);
    const captura: ApiCaptura = {
      metodo: "GET",
      url: redactar(res.url()),
      status: res.status(),
      requestHeaders: headersLimpios({
        accept: "application/json",
        origin: APP_URL,
        ...(empresa ? { [COMPANY_HEADER.toLowerCase()]: empresa } : {}),
      }),
      responseHeaders: headersLimpios(res.headers()),
      requestBody: null,
      body,
      truncado,
      origen: "qa",
    };
    this.evidencia.capturas.push(captura);
    let json: T | null = null;
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
    return { status: res.status(), json, captura };
  }
}

/** Espera la respuesta /api que calce con el patrón. `null` si no llegó (la página no la pidió). */
export async function esperarApi(
  page: Page,
  patron: RegExp,
  opts: { metodo?: string; timeout?: number } = {},
): Promise<Response | null> {
  const metodo = opts.metodo ?? "GET";
  try {
    return await page.waitForResponse(
      (r) => {
        if (r.request().method() !== metodo) return false;
        const u = new URL(r.url());
        return esApi(r.url()) && patron.test(u.pathname + u.search);
      },
      { timeout: opts.timeout ?? 45_000 },
    );
  } catch {
    return null;
  }
}

export async function jsonDeRespuesta<T = unknown>(r: Response | null): Promise<T | null> {
  if (!r) return null;
  try {
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Cookies de sesión para el host de la app y el de la API. */
export function cookiesDeSesion(valor: string) {
  const hosts = [...new Set([new URL(APP_URL).hostname, new URL(API_URL).hostname])];
  return hosts.map((domain) => ({
    name: "qavante_session",
    value: valor,
    domain,
    path: "/",
    httpOnly: true,
    secure: APP_URL.startsWith("https") || API_URL.startsWith("https"),
    sameSite: "Lax" as const,
  }));
}

type Fixtures = {
  /** Auto: vuelca screenshot + api.json al final de cada test y aplica la guardia. */
  volcado: void;
  evidencia: Evidencia;
  api: ApiLectura;
  /** Sociedad activa resuelta (env o la marcada por defecto). */
  empresa: string;
};

type OpcionesWorker = {
  /** Valor de la cookie para este archivo de tests. `""` → sin cookie (pruebas de 401). */
  sesion: string;
};

export const test = base.extend<Fixtures & OpcionesWorker>({
  sesion: [SESSION, { option: true }],

  evidencia: async ({}, entregar) => {
    await entregar(new Evidencia());
  },

  context: async ({ context, sesion, evidencia }, entregar) => {
    if (sesion) await context.addCookies(cookiesDeSesion(sesion));
    if (LEGAL_ENTITY_ID) {
      await context.addInitScript(
        ([k, v]) => {
          try {
            window.localStorage.setItem(k, v);
          } catch {
            /* storage bloqueado: la app usa la sociedad por defecto. */
          }
        },
        [ACTIVE_COMPANY_STORAGE_KEY, LEGAL_ENTITY_ID] as const,
      );
    }
    await instalarGuardia(context, evidencia.bloqueos);
    context.on("response", (res) => {
      if (esApi(res.url())) evidencia.registrar(capturarRespuesta(res, "pagina"));
    });
    await entregar(context);
  },

  empresa: async ({ context, evidencia }, entregar) => {
    let id = LEGAL_ENTITY_ID;
    if (!id) {
      const res = await context.request.get(`${API_URL}/api/legal-entities`, {
        headers: { Accept: "application/json", Origin: APP_URL },
        failOnStatusCode: false,
      });
      const data = (await res.json().catch(() => null)) as {
        entities?: { id: string; is_default: boolean }[];
      } | null;
      const lista = data?.entities ?? [];
      id = lista.find((e) => e.is_default)?.id ?? lista[0]?.id ?? "";
      evidencia.nota(
        `Sociedad activa resuelta: ${id || "ninguna"} (GET /api/legal-entities → ${res.status()})`,
      );
    }
    await entregar(id);
  },

  api: async ({ context, evidencia, empresa }, entregar) => {
    await entregar(new ApiLectura(context.request, evidencia, () => empresa));
  },

  volcado: [
    async ({ page, evidencia }, entregar, testInfo) => {
      const id = idEvidencia(testInfo);
      const dir = path.join(RAIZ_EVIDENCIA, id);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });

      await entregar();

      await evidencia.listo();
      if (page.url() !== "about:blank" && !page.isClosed()) {
        try {
          const png = await page.screenshot({ fullPage: true, timeout: 20_000 });
          fs.writeFileSync(path.join(dir, "pagina.png"), png);
          await testInfo.attach(`${id}-pagina.png`, { body: png, contentType: "image/png" });
        } catch (e) {
          evidencia.nota(`No se pudo tomar el screenshot: ${(e as Error).message}`);
        }
      }
      const json = JSON.stringify(
        {
          id,
          test: testInfo.title,
          archivo: path.basename(testInfo.file),
          estado: testInfo.status,
          app: APP_URL,
          api: API_URL,
          url_final: page.isClosed() ? null : redactar(page.url()),
          generado: new Date().toISOString(),
          notas: evidencia.notas,
          escrituras_bloqueadas: evidencia.bloqueos,
          llamadas: evidencia.capturas,
        },
        null,
        2,
      );
      fs.writeFileSync(path.join(dir, "api.json"), json);
      await testInfo.attach(`${id}-api.json`, { body: json, contentType: "application/json" });

      // La guardia hace FALLAR el test si la página intentó escribir.
      expect(
        evidencia.bloqueos,
        `La página intentó escribir en producción y la guardia lo abortó:\n${evidencia.bloqueos
          .map((b) => `  ${b.metodo} ${b.url} (${b.motivo})`)
          .join("\n")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
