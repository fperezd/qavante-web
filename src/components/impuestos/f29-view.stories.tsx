import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { F29View } from "./f29-view";

/* F29View — Sprint C1, ruta `/pagar/impuestos/f29`. Contenedor con hooks
   (`useSiiHealth`, `useSiiF29`). Para story-earlo necesitamos MSW
   handlers que reproduzcan los casos canónicos del contrato:
   - éxito (folio 1234567890 → F29 vigente Abril 2026 con montos)
   - folio no encontrado (HTTP 200 con status='not_found')
   - credencial ausente (HTTP 412)
   - SII no responde (HTTP 502)

   El user en la story tipea el folio + submitea — el handler MSW
   responde según el folio. Stories de visual-regression toman snapshot
   del estado pre-submit (form vacío + empty) — los estados post-submit
   se ejercitan en interaction tests si se agregan después. */

const SII_HEALTH_OK = http.get("*/api/sii/health", () =>
  HttpResponse.json(
    {
      status: "ok",
      reachable: true,
      rut_configured: true,
      cert_available: true,
      ambiente: "produccion",
      code: null,
      message: null,
      details: null,
      error: null,
    },
    { status: 200 },
  ),
);

const SII_HEALTH_NO_CREDS = http.get("*/api/sii/health", () =>
  HttpResponse.json(
    {
      status: "ok",
      reachable: true,
      rut_configured: false,
      cert_available: false,
      ambiente: "produccion",
      code: null,
      message: null,
      details: null,
      error: null,
    },
    { status: 200 },
  ),
);

const F29_OK = http.get("*/api/sii/f29/:folio", () =>
  HttpResponse.json(
    {
      status: "ok",
      folio: 1234567890,
      period: { year: 2026, month: 4 },
      rut_base: 76123456,
      estado: "vigente",
      fecha_presentacion: "2026-05-12",
      iva_debito_fiscal: 4500000,
      iva_credito_fiscal: 3200000,
      ppm: 850000,
      total_a_pagar: 2150000,
      code: null,
      message: null,
      details: null,
      error: null,
    },
    { status: 200 },
  ),
);

const F29_NOT_FOUND = http.get("*/api/sii/f29/:folio", ({ params }) =>
  HttpResponse.json(
    {
      status: "not_found",
      folio: Number(params.folio),
      period: { year: 2026, month: 4 },
      rut_base: 76123456,
      estado: "sin_declaracion",
      fecha_presentacion: null,
      iva_debito_fiscal: null,
      iva_credito_fiscal: null,
      ppm: null,
      total_a_pagar: null,
      code: "folio_not_found",
      message: "El folio no corresponde a una declaración del período consultado.",
      details: null,
      error: null,
    },
    { status: 200 },
  ),
);

const F29_NO_CREDENTIAL = http.get("*/api/sii/f29/:folio", () =>
  HttpResponse.json(
    { code: "credential_missing", detail: "Falta clave tributaria del SII." },
    { status: 412 },
  ),
);

const F29_SII_DOWN = http.get("*/api/sii/f29/:folio", () =>
  HttpResponse.json({ code: "sii_unavailable", detail: "SII no responde." }, { status: 502 }),
);

const meta = {
  title: "Capa 2 / Impuestos / F29View",
  component: F29View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Consultor F29 (Sprint C1, ruta `/pagar/impuestos/f29`). Contenedor con hooks; las stories activan MSW handlers para reproducir los 4 casos canónicos del contrato (ok / not_found / 412 sin credencial / 502 SII down). El visual snapshot captura el estado pre-submit; los estados post-submit requieren interacción manual en Storybook UI.",
      },
    },
    msw: {
      handlers: [SII_HEALTH_OK, F29_OK],
    },
  },
} satisfies Meta<typeof F29View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  name: "Inicial — form vacío + health OK",
  parameters: {
    docs: {
      description: {
        story:
          "Estado por defecto al entrar a `/pagar/impuestos/f29`. Form vacío + empty-state explicando qué se va a ver tras consultar.",
      },
    },
    msw: { handlers: [SII_HEALTH_OK, F29_OK] },
  },
};

export const SinCredencialSii: Story = {
  name: "Sin credencial SII (banner)",
  parameters: {
    docs: {
      description: {
        story:
          "Health detecta que la clave tributaria no está configurada → banner amarillo invitando a `/administracion/credenciales`. El form sigue visible (no bloqueamos la UI hasta que el user intente).",
      },
    },
    msw: { handlers: [SII_HEALTH_NO_CREDS, F29_OK] },
  },
};

export const ConsultaOkInteractivo: Story = {
  name: "Consulta OK (post-submit — interactivo)",
  parameters: {
    docs: {
      description: {
        story:
          "Tipear folio `1234567890` + click 'Consultar F29' → F29 vigente Abril 2026 con montos + botón 'Descargar PDF'. Snapshot toma el estado inicial; el render con datos se ejercita en Storybook UI.",
      },
    },
    msw: { handlers: [SII_HEALTH_OK, F29_OK] },
  },
};

export const FolioNoEncontradoInteractivo: Story = {
  name: "Folio no encontrado (post-submit — interactivo)",
  parameters: {
    docs: {
      description: {
        story:
          "Tipear cualquier folio (≠ 1234567890) → HTTP 200 con `status='not_found'`. UI amarilla (no roja): 'Sin declaración para este folio'.",
      },
    },
    msw: { handlers: [SII_HEALTH_OK, F29_NOT_FOUND] },
  },
};

export const SiiNoRespondeInteractivo: Story = {
  name: "SII no responde 502 (post-submit — interactivo)",
  parameters: {
    docs: {
      description: {
        story:
          "Tipear cualquier folio → HTTP 502. Banner amarillo: 'El SII no responde en este momento'. Específico, no error genérico.",
      },
    },
    msw: { handlers: [SII_HEALTH_OK, F29_SII_DOWN] },
  },
};

export const FaltaClaveTributariaInteractivo: Story = {
  name: "412 sin credencial (post-submit — interactivo)",
  parameters: {
    docs: {
      description: {
        story:
          "Health dice OK pero el endpoint /f29 devuelve 412 → banner 'Falta configurar tu clave tributaria'. Mismo banner que el caso de health-fail, ahora disparado por el F29.",
      },
    },
    msw: { handlers: [SII_HEALTH_OK, F29_NO_CREDENTIAL] },
  },
};
