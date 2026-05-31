"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Download, FileText, Lock, Receipt, Search } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { siiF29PdfUrl, useSiiF29, useSiiHealth, type F29Response } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { f29FormSchema, parseFolio, type F29FormValues } from "./f29-form-schema";

/* Vista del consultor F29 — Sprint C1, ruta `/pagar/impuestos/f29`. Patrón
   "página = contenedor": el screen resuelve el flag `siiQueries`
   (ADR-0008) y monta esta vista (client). El user ingresa el folio del
   Certificado Solemne y consultamos `GET /api/sii/f29/{folio}` parseado.

   Casos del contrato cubiertos (regla 16 — todos del OpenAPI verificado
   contra prod 2026-05-23):
   - `status='ok'`: muestra montos parseados (IVA débito/crédito, PPM,
     total a pagar) + botón "Descargar PDF".
   - `status='not_found'` (HTTP 200): mensaje "Sin declaración para este
     folio" — NO es error visible (UI amarilla, no roja).
   - HTTP 412 (sin credencial SII): banner que invita a configurar la
     clave tributaria en /administracion/credenciales.
   - HTTP 502 (SII inalcanzable / parse error): error inline genérico.
   - HTTP 422 (folio inválido): cubierto por el schema client-side
     antes del fetch.

   §17.4: el FE no edita ni inventa montos; solo muestra lo parseado por
   el backend. NO calculamos diferencias ni proyecciones (eso es Sprint C5). */

const ESTADO_LABEL: Record<string, string> = {
  vigente: "Vigente",
  rectificatoria: "Rectificatoria",
  rechazada: "Rechazada",
  sin_declaracion: "Sin declaración",
};

function formatPeriod(p: F29Response["period"]): string {
  /* Format "YYYY-MM" humano: "Abril 2026". */
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const month = meses[p.month - 1] ?? `Mes ${p.month}`;
  return `${month} ${p.year}`;
}

function MontoRow({ label, amount }: { label: string; amount: number | null | undefined }) {
  /* §15.7 / §17.4 — si el backend no completó el parseo, mostramos "—",
     no "$ 0" (que sería falsa precisión). */
  return (
    <div className="flex items-baseline justify-between border-b border-neutral-light/40 py-1.5">
      <dt className="text-sm text-neutral-mid">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-neutral-dark">
        {amount == null ? <span className="text-neutral-mid">—</span> : formatClp(amount)}
      </dd>
    </div>
  );
}

function SinCredencialBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-500/5 p-4 text-sm text-neutral-dark"
    >
      <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-700" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Falta configurar tu clave tributaria.</p>
        <p className="text-neutral-mid">
          Para consultar tu F29 necesitamos tu RUT y clave del SII configurados.
        </p>
        <a
          href="/administracion/credenciales"
          className="inline-block pt-1 text-sm font-medium text-brand-primary hover:underline"
        >
          Ir a Credenciales →
        </a>
      </div>
    </div>
  );
}

function HealthBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-info-500/30 bg-info-500/5 p-3 text-xs text-neutral-dark"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-info-600" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function F29Result({ data, folio }: { data: F29Response; folio: number }) {
  const isOk = data.status === "ok";
  const notFound = data.status === "not_found";
  const pdfUrl = isOk ? siiF29PdfUrl(folio) : null;

  if (notFound) {
    return (
      <QavanteEmpty
        icon={Search}
        title="Sin declaración para este folio"
        description={
          data.message ??
          "El folio no corresponde a una declaración del período consultado. Verifica el número y reintenta."
        }
      />
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span className="font-medium">F29 — folio {folio}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {data.estado && (
              <QavanteBadge variant={data.estado === "vigente" ? "success" : "warning"}>
                {ESTADO_LABEL[data.estado] ?? data.estado}
              </QavanteBadge>
            )}
            {isOk && (
              <span className="flex items-center gap-1 text-xs text-success-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Declaración encontrada
              </span>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-mid">Período</dt>
            <dd className="font-medium text-neutral-dark">{formatPeriod(data.period)}</dd>
          </div>
          <div>
            <dt className="text-neutral-mid">RUT base</dt>
            <dd className="font-mono text-neutral-dark">{data.rut_base}</dd>
          </div>
          {data.fecha_presentacion && (
            <div>
              <dt className="text-neutral-mid">Fecha de presentación</dt>
              <dd className="text-neutral-dark">{data.fecha_presentacion}</dd>
            </div>
          )}
        </dl>

        <section aria-labelledby="montos-heading" className="space-y-1">
          <h3
            id="montos-heading"
            className="text-xs font-medium uppercase tracking-wide text-neutral-mid"
          >
            Montos declarados
          </h3>
          <dl className="space-y-0">
            <MontoRow label="IVA débito fiscal" amount={data.iva_debito_fiscal} />
            <MontoRow label="IVA crédito fiscal" amount={data.iva_credito_fiscal} />
            <MontoRow label="PPM (Pago Provisional Mensual)" amount={data.ppm} />
            <MontoRow label="Total a pagar" amount={data.total_a_pagar} />
          </dl>
          {data.iva_debito_fiscal == null && data.total_a_pagar == null && (
            <HealthBanner message="Los montos están en proceso de parseo. Puedes ver el PDF original mientras tanto." />
          )}
        </section>

        {pdfUrl && (
          <div className="pt-1">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-primary px-4 text-sm font-medium text-surface hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar PDF del Certificado Solemne
            </a>
            <p className="mt-1 text-xs text-neutral-mid">
              El PDF se descarga directamente desde el SII vía Qavante.
            </p>
          </div>
        )}
      </div>
    </QavanteCard>
  );
}

export function F29View() {
  const healthQuery = useSiiHealth();
  const [activeFolio, setActiveFolio] = React.useState<number | null>(null);
  const f29Query = useSiiF29(activeFolio ?? 0);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<F29FormValues>({
    resolver: zodResolver(f29FormSchema),
    defaultValues: { folioInput: "" },
    mode: "onBlur",
  });

  function onSubmit(values: F29FormValues) {
    setActiveFolio(parseFolio(values.folioInput));
  }

  /* Detectar 412 (sin credencial) — el contrato es claro en este código.
     ApiError ya viene con .status; cualquier 412 dispara el banner de
     "configurar credenciales" en vez del error genérico. */
  const isCredencialMissing =
    f29Query.isError && f29Query.error instanceof ApiError && f29Query.error.status === 412;

  const healthOk =
    healthQuery.data?.status === "ok" &&
    healthQuery.data?.rut_configured &&
    healthQuery.data?.cert_available;

  return (
    <div className="space-y-6">
      <section aria-labelledby="form-heading" className="space-y-3">
        <h2 id="form-heading" className="sr-only">
          Consultar F29
        </h2>
        <QavanteCard variant="bordered">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <label htmlFor="f29-folio" className="text-sm font-medium text-neutral-dark">
                Folio del F29
              </label>
              <Controller
                control={control}
                name="folioInput"
                render={({ field }) => (
                  <QavanteInput
                    id="f29-folio"
                    placeholder="Ej: 1234567890"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.folioInput)}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-required="true"
                    aria-describedby={errors.folioInput ? "f29-folio-error" : "f29-folio-hint"}
                  />
                )}
              />
              <p id="f29-folio-hint" className="text-xs text-neutral-mid">
                Lo encontrás en la copia del SII o en tu correo de confirmación.
              </p>
              {errors.folioInput && (
                <p id="f29-folio-error" className="text-xs text-danger-500" role="alert">
                  {errors.folioInput.message}
                </p>
              )}
            </div>
            <QavanteButton type="submit" loading={isSubmitting || f29Query.isFetching}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Consultar F29
            </QavanteButton>
          </form>
        </QavanteCard>
        {!healthQuery.isLoading && !healthOk && !healthQuery.isError && <SinCredencialBanner />}
      </section>

      {activeFolio && f29Query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-md bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando F29 al SII"
        />
      )}

      {isCredencialMissing && <SinCredencialBanner />}

      {activeFolio &&
        f29Query.isError &&
        !isCredencialMissing &&
        (f29Query.error instanceof ApiError && f29Query.error.status === 502 ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-500/5 p-4 text-sm text-neutral-dark"
          >
            <AlertCircle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-700"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">El SII no responde en este momento.</p>
              <p className="text-neutral-mid">
                Suele ser temporal. Reintenta en unos minutos —{" "}
                {apiErrorToUserMessage(f29Query.error)}
              </p>
            </div>
          </div>
        ) : (
          <QavanteInlineError error={f29Query.error} what="el F29" />
        ))}

      {activeFolio && f29Query.data && <F29Result data={f29Query.data} folio={activeFolio} />}

      {!activeFolio && (
        <QavanteEmpty
          icon={FileText}
          title="Consulta un F29 ingresando su folio"
          description="Vas a ver el período declarado, los montos (IVA débito/crédito, PPM, total a pagar) y vas a poder descargar el PDF del Certificado Solemne."
        />
      )}
    </div>
  );
}
