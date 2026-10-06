import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";
import {
  DOCUMENTS_PAGE_SIZE,
  type ReceivableDocumentsResponse,
  cobranzaKeys,
  esCorteVencido,
  receivableDocumentsPath,
} from "./cobranza";
import { ApiError } from "./errors";
import { server } from "@/test/msw/node";
import {
  moverLaCartera,
  resetCartera,
  receivableDocumentsHandlers,
} from "@/test/msw/receivable-documents";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

/* ── #207, el mismo defecto un grano más abajo: los DOCUMENTOS ───────────────────────────────
 *
 * El directorio de deudores ya consume `/debtors` con búsqueda y paginación del servidor. La
 * lista de documentos de la misma pantalla seguía pidiendo `?limit=100`, sin mandar nunca el
 * `q` que el contrato publica, y buscando en memoria sobre lo traído. Estos tests fijan las
 * dos mitades: que la consulta VIAJA, y que el conteo que se publica no es un `.length`.
 *
 * El fixture (`src/test/msw/receivable-documents.ts`) resuelve `q`, `limit` y `offset` de
 * verdad: contra un handler que devolviera siempre lo mismo, la pantalla rota pasaría igual. */

const get = (path: string) => api.get<ReceivableDocumentsResponse>(path);

function conHandlers() {
  server.use(...receivableDocumentsHandlers);
}

afterEach(() => {
  resetCartera();
});

describe("receivableDocumentsPath · la consulta que viaja", () => {
  it("serializa `limit`, `offset` y `q` con los nombres del contrato", () => {
    expect(receivableDocumentsPath("  volcan  ", 50)).toBe(
      "/api/treasury/accounts-receivable/documents?limit=50&offset=50&q=volcan",
    );
  });

  // EL GEMELO: un blanco no es una búsqueda, y la primera página no lleva `q` de más.
  it("no manda `q` cuando la consulta es sólo espacios", () => {
    expect(receivableDocumentsPath("   ")).toBe(
      `/api/treasury/accounts-receivable/documents?limit=${DOCUMENTS_PAGE_SIZE}&offset=0`,
    );
  });
});

describe("(a) el documento fuera de la página cargada · LA REGRESIÓN DEL ISSUE", () => {
  it("encuentra a VOLCAN aunque no esté entre las filas traídas", async () => {
    conHandlers();
    const primera = await get(receivableDocumentsPath("", 0, 2));
    expect(primera.items.map((d) => d.folio)).toEqual(["F-1001", "F-1002"]);
    // Premisa del test, no adorno: si VOLCAN ya estuviera cargado, buscarlo no probaría nada.
    expect(primera.items.some((d) => d.customer_name.includes("VOLCAN"))).toBe(false);

    const busqueda = await get(receivableDocumentsPath("volcan", 0, 2));
    expect(busqueda.items.map((d) => d.customer_name)).toEqual(["VOLCAN Comercializadora SpA"]);
    expect(busqueda.items[0]!.outstanding_amount).toBe("13300");
    expect(busqueda.total).toBe(1);
  });

  /* EL GEMELO: la búsqueda en memoria sobre esa misma primera página NO lo encuentra. Esto es
     lo que hacía la pantalla antes, escrito como test: sin él, el test de arriba no demuestra
     que el arreglo era necesario, sólo que el servidor funciona. */
  it("el filtro en memoria sobre lo traído NO lo encuentra: por eso había que subir la consulta", async () => {
    conHandlers();
    const primera = await get(receivableDocumentsPath("", 0, 2));
    const enMemoria = primera.items.filter((item) =>
      `${item.customer_name} ${item.customer_rut ?? ""} ${item.folio}`
        .toLocaleLowerCase("es-CL")
        .includes("volcan"),
    );
    expect(enMemoria).toHaveLength(0);
  });

  it("busca también por folio y por RUT, no sólo por nombre", async () => {
    conHandlers();
    expect((await get(receivableDocumentsPath("F-1007"))).items.map((d) => d.folio)).toEqual([
      "F-1007",
    ]);
    expect((await get(receivableDocumentsPath("80.111.222-3"))).items.map((d) => d.folio)).toEqual([
      "F-1007",
    ]);
  });
});

describe("(b) el conteo sale del servidor, no del largo de la página", () => {
  it("`total` cuenta la cartera entera aunque la página traiga dos filas", async () => {
    conHandlers();
    const primera = await get(receivableDocumentsPath("", 0, 2));
    expect(primera.items).toHaveLength(2);
    expect(primera.total).toBe(7);
    // El `.length` y el total son números DISTINTOS acá: ésa es toda la diferencia.
    expect(primera.items.length).not.toBe(primera.total);
  });

  /* EL GEMELO: `total` no se mueve con el tamaño de página. Un total que cambiara con `limit`
     sería el mismo `.length` con otro nombre. */
  it("`total` no cambia con el tamaño de página", async () => {
    conHandlers();
    const dos = await get(receivableDocumentsPath("", 0, 2));
    const cinco = await get(receivableDocumentsPath("", 0, 5));
    expect(dos.total).toBe(cinco.total);
    expect(dos.items.length).not.toBe(cinco.items.length);
  });

  it("recorre las siete en páginas de dos sin perder ni repetir ninguna", async () => {
    conHandlers();
    const folios: string[] = [];
    let offset = 0;
    for (let i = 0; i < 10; i += 1) {
      const page = await get(receivableDocumentsPath("", offset, 2));
      folios.push(...page.items.map((d) => d.folio));
      offset += page.items.length;
      if (offset >= page.total || page.items.length === 0) break;
    }
    expect(folios).toEqual(["F-1001", "F-1002", "F-1003", "F-1004", "F-1005", "F-1006", "F-1007"]);
    expect(new Set(folios).size).toBe(7);
  });
});

describe("(c) cambiar un filtro REINICIA el recorrido", () => {
  it("la clave de React Query lleva la búsqueda: un término nuevo es otra consulta desde cero", () => {
    const sinBusqueda = cobranzaKeys.documents("empresa-1", "");
    const conBusqueda = cobranzaKeys.documents("empresa-1", "volcan");
    expect(conBusqueda).not.toEqual(sinBusqueda);
    // Y la empresa activa también: cambiar de sociedad no sirve la cartera de la anterior.
    expect(cobranzaKeys.documents("empresa-2", "volcan")).not.toEqual(conBusqueda);
  });

  /* EL GEMELO: el MISMO filtro da la MISMA clave. Sin esto, una clave que cambiara sola
     reiniciaría el recorrido en cada render y "traer más" nunca encadenaría una página. */
  it("el mismo filtro y la misma empresa dan la misma clave: las páginas encadenan", () => {
    expect(cobranzaKeys.documents("empresa-1", "volcan")).toEqual(
      cobranzaKeys.documents("empresa-1", "volcan"),
    );
  });

  it("una consulta nueva arranca en `offset=0`, nunca arrastra el offset de la anterior", () => {
    expect(receivableDocumentsPath("volcan")).toContain("offset=0");
  });
});

describe("(d) la respuesta que llega tarde para una consulta ya cambiada no se pinta", () => {
  it("la respuesta vieja queda en SU clave y no puede sobrescribir la activa", async () => {
    conHandlers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const claveVieja = cobranzaKeys.documents("empresa-1", "minera");
    const claveNueva = cobranzaKeys.documents("empresa-1", "volcan");

    /* Las dos salen a la vez y la VIEJA se resuelve DESPUÉS: es exactamente el orden que
       pintaba la cifra falsa cuando la respuesta no tenía una clave propia. */
    const nueva = client.fetchQuery({
      queryKey: claveNueva,
      queryFn: () => get(receivableDocumentsPath("volcan")),
    });
    const vieja = client.fetchQuery({
      queryKey: claveVieja,
      queryFn: async () => {
        const r = await get(receivableDocumentsPath("minera"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        return r;
      },
    });
    await nueva;
    await vieja;

    const activa = client.getQueryData<ReceivableDocumentsResponse>(claveNueva);
    expect(activa?.items.map((d) => d.customer_name)).toEqual(["VOLCAN Comercializadora SpA"]);
    expect(activa?.total).toBe(1);
    // La vieja existe, pero en su propio cajón: nunca llega a la consulta nueva.
    const guardada = client.getQueryData<ReceivableDocumentsResponse>(claveVieja);
    expect(guardada?.items.every((d) => d.customer_name.includes("Minera"))).toBe(true);
    client.clear();
  });

  /* EL GEMELO: si las dos consultas compartieran clave —que es lo que pasaba cuando ni la
     empresa activa ni el término entraban en ella— la tardía SÍ se pinta encima. */
  it("con una sola clave para las dos consultas, la tardía sí pisa a la nueva", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const unica = ["cobranza", "documents"] as const;
    client.setQueryData(unica, { marca: "nueva" });
    client.setQueryData(unica, { marca: "vieja-que-llego-tarde" });
    expect(client.getQueryData(unica)).toEqual({ marca: "vieja-que-llego-tarde" });
    client.clear();
  });
});

describe("409 y 422: el corte que se estaba leyendo dejó de servir", () => {
  it("un 409 llega cuando la cartera se movió bajo los pies del cursor", async () => {
    conHandlers();
    await get(receivableDocumentsPath("", 0, 2));
    moverLaCartera();
    const error = await get(receivableDocumentsPath("", 2, 2)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect(esCorteVencido(error)).toBe(true);
  });

  it("un 422 por página incompatible se reconoce igual, y se arregla igual", () => {
    expect(esCorteVencido(new ApiError("cursor incompatible", 422))).toBe(true);
    expect(esCorteVencido(new ApiError("snapshot changed", 409))).toBe(true);
  });

  /* EL GEMELO: un 500 NO es un corte vencido. Si lo fuera, la pantalla ofrecería "traer el
     corte nuevo" ante una caída del servidor: un botón que no arregla nada. */
  it("un error cualquiera NO se confunde con un corte vencido", () => {
    expect(esCorteVencido(new ApiError("boom", 500))).toBe(false);
    expect(esCorteVencido(new ApiError("nope", 404))).toBe(false);
    expect(esCorteVencido(new Error("red"))).toBe(false);
  });

  it("después del 409, la primera página sigue sirviendo: el recorrido se reinicia, no se cae", async () => {
    conHandlers();
    moverLaCartera();
    const reinicio = await get(receivableDocumentsPath("", 0, 2));
    expect(reinicio.items).toHaveLength(2);
    expect(reinicio.total).toBe(7);
  });
});
