import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

import { XLSX_MIME } from "@/lib/export/xlsx";
import { ApiError } from "./errors";
import { exportOperationalResultXlsx, operationalResultExportXlsxPath } from "./gestion";

const BASE = "http://api.test";
const ENDPOINT = `${BASE}/api/management/operational-result/export`;
const PATH =
  "/api/management/operational-result/export?period_from=2026-05&period_to=2026-07&format=xlsx&include_proforma=true";
const FILENAME = "resultado-operacional_2026-05_2026-07.xlsx";
const XLSX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);

afterEach(() => server.resetHandlers());

function xlsxResponse(
  overrides: {
    bytes?: Uint8Array;
    contentType?: string;
    contentDisposition?: string | null;
  } = {},
) {
  const headers = new Headers({ "content-type": overrides.contentType ?? XLSX_MIME });
  const disposition =
    overrides.contentDisposition === undefined
      ? `attachment; filename="${FILENAME}"`
      : overrides.contentDisposition;
  if (disposition != null) headers.set("content-disposition", disposition);
  return new HttpResponse(overrides.bytes ?? XLSX_BYTES, { headers });
}

describe("exportación XLSX nativa de Gestión", () => {
  it("pide el mismo rango del pivote como XLSX e incluye el mes proforma", () => {
    expect(operationalResultExportXlsxPath("2026-05", "2026-07")).toBe(PATH);
  });

  it("conserva bytes, nombre y MIME contractuales y envía Accept XLSX", async () => {
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        expect(request.url).toBe(`${BASE}${PATH}`);
        expect(request.headers.get("accept")).toBe(XLSX_MIME);
        expect(request.credentials).toBe("include");
        return xlsxResponse();
      }),
    );

    await expect(exportOperationalResultXlsx("2026-05", "2026-07")).resolves.toEqual({
      bytes: XLSX_BYTES,
      filename: FILENAME,
      contentType: XLSX_MIME,
    });
  });

  it.each([
    {
      name: "MIME de texto",
      response: { contentType: "text/csv" },
      code: "invalid_xlsx_mime",
    },
    {
      name: "Content-Disposition ausente",
      response: { contentDisposition: null },
      code: "invalid_content_disposition",
    },
    {
      name: "nombre distinto al contrato",
      response: { contentDisposition: 'attachment; filename="reporte.xlsx"' },
      code: "invalid_xlsx_filename",
    },
    {
      name: "ZIP magic ausente",
      response: { bytes: new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]) },
      code: "invalid_xlsx_magic",
    },
  ])("rechaza $name en vez de descargar un archivo plausible", async ({ response, code }) => {
    server.use(http.get(ENDPOINT, () => xlsxResponse(response)));
    await expect(exportOperationalResultXlsx("2026-05", "2026-07")).rejects.toMatchObject({
      status: 200,
      code,
    });
    await expect(exportOperationalResultXlsx("2026-05", "2026-07")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("preserva el estado HTTP y no expone el detalle libre del servidor", async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({ detail: "El rango no es válido." }, { status: 422 }),
      ),
    );
    await expect(exportOperationalResultXlsx("2026-05", "2026-07")).rejects.toMatchObject({
      status: 422,
      message: "Algunos datos no son válidos. Revisa el formulario.",
    });
  });
});
