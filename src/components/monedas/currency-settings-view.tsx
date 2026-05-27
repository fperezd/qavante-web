"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Coins, Pencil, RefreshCw } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteEmpty,
  QavanteButton,
  QavanteInlineError,
} from "@/components/qavante";
import {
  useCompanyCurrencySettings,
  useCurrencies,
  useExchangeRate,
  type Currency,
  type CompanyCurrencySettings,
} from "@/lib/api/currencies";

/* Vista de Monedas — Addendum §15/§16. Patrón "página = contenedor": el
   screen `/administracion/monedas` resuelve el flag `multiCurrency`
   (ADR-0008) y monta esta vista (client). Lee settings + catálogo + TC, y
   ofrece edición vía dialog (PATCH §15.4). El gating fino owner/admin lo
   hace el backend (403 → message del Anexo C.3), igual que en usuarios.

   §15.7: la ausencia de TC NO es un error — `data_status='requires_attention'`
   y la card del par muestra "Sin datos" en banda warning, NO en danger. */

/* Lazy: separa Base UI Dialog + react-hook-form + zod del First Load JS de
   `/administracion/monedas`. Solo se descarga al abrir el editor. ssr:false
   porque el dialog es interactivo client-only. */
const CurrencySettingsDialog = dynamic(
  () =>
    import("./currency-settings-dialog").then((m) => ({
      default: m.CurrencySettingsDialog,
    })),
  { ssr: false },
);

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
    </div>
  );
}

function findCurrencyLabel(currencies: Currency[], code: string | null | undefined): string {
  if (!code) return "—";
  const c = currencies.find((x) => x.code === code);
  return c ? `${c.code} · ${c.name}` : code;
}

interface ExchangeRateCardProps {
  base: string;
  quote: string;
}

/* Card por par TC. Aislamos para que cada uno tenga su propio query
   (cacheado por par en `currenciesKeys.exchangeRate({base,quote})`). */
function ExchangeRateCard({ base, quote }: ExchangeRateCardProps) {
  const { data, isLoading, isError, refetch, isFetching } = useExchangeRate({ base, quote });

  const hasRate = data?.data_status === "ok" && data?.rate;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            {base} → {quote}
          </span>
          {hasRate ? (
            <QavanteBadge variant="success">Vigente</QavanteBadge>
          ) : (
            <QavanteBadge variant="warning">Sin datos</QavanteBadge>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="h-6 w-32 animate-pulse rounded bg-neutral-light/30" aria-hidden="true" />
      ) : isError ? (
        <p className="text-sm text-danger-500">No pudimos consultar el tipo de cambio.</p>
      ) : hasRate && data?.rate ? (
        <div className="space-y-1">
          <p className="text-xl font-semibold text-neutral-dark">{data.rate.rate}</p>
          <p className="text-xs text-neutral-mid">
            Fecha: {data.rate.rate_date} · Fuente: {data.rate.source}
          </p>
        </div>
      ) : (
        /* §15.7: ausencia tolerada — texto guía, NO error. */
        <div className="space-y-2">
          <p className="text-sm text-neutral-mid">
            No tenemos el tipo de cambio publicado para esta fecha.
          </p>
          <QavanteButton size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Consultando…" : "Reintentar"}
          </QavanteButton>
        </div>
      )}
    </QavanteCard>
  );
}

export function CurrencySettingsView() {
  const settingsQuery = useCompanyCurrencySettings();
  const currenciesQuery = useCurrencies();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (settingsQuery.isLoading || currenciesQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (settingsQuery.isError) {
    return <QavanteInlineError error={settingsQuery.error} what="los ajustes de moneda" />;
  }
  if (currenciesQuery.isError) {
    return <QavanteInlineError error={currenciesQuery.error} what="el catálogo de monedas" />;
  }

  const settings: CompanyCurrencySettings | null = settingsQuery.data ?? null;
  const currencies = currenciesQuery.data?.items ?? [];

  if (!settings) {
    /* §15.4: settings ausentes → empty con CTA primaria que abre el dialog
       en modo "configurar" (defaults Chile: CLP funcional). */
    return (
      <>
        <QavanteEmpty
          icon={Coins}
          title="Aún no configuraste tus monedas"
          description="Elige tu moneda funcional, monedas de reporte y, si la usas, la unidad indexada (UF / UTM)."
          cta={
            <QavanteButton onClick={() => setDialogOpen(true)}>
              <Coins className="h-4 w-4" />
              Configurar monedas
            </QavanteButton>
          }
        />
        <CurrencySettingsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          settings={null}
          currencies={currencies}
        />
      </>
    );
  }

  const functionalLabel = findCurrencyLabel(currencies, settings.functional_currency_code);
  const reportingCodes = settings.reporting_currency_codes ?? [];
  const indexedLabel = settings.indexed_unit_enabled
    ? findCurrencyLabel(currencies, settings.indexed_unit_currency_code)
    : "Desactivada";

  /* Pares de TC a mostrar: cada reporting → functional + indexed_unit →
     functional (típicamente UF → CLP). Determinístico, sin cálculo de
     negocio (regla §16.3 del addendum). */
  const tcPairs: ExchangeRateCardProps[] = [
    ...reportingCodes.map((code: string) => ({
      base: code,
      quote: settings.functional_currency_code,
    })),
    ...(settings.indexed_unit_enabled && settings.indexed_unit_currency_code
      ? [{ base: settings.indexed_unit_currency_code, quote: settings.functional_currency_code }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="sr-only">
          Ajustes de moneda
        </h2>
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span>Ajustes</span>
              </span>
              <QavanteButton
                size="sm"
                variant="ghost"
                onClick={() => setDialogOpen(true)}
                aria-label="Editar ajustes de moneda"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Editar
              </QavanteButton>
            </div>
          }
        >
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-mid">Moneda funcional</dt>
              <dd className="font-medium text-neutral-dark">{functionalLabel}</dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Moneda de reporte por defecto</dt>
              <dd className="font-medium text-neutral-dark">
                {findCurrencyLabel(currencies, settings.default_reporting_currency_code)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Monedas de reporte adicionales</dt>
              <dd className="flex flex-wrap gap-1 pt-1">
                {reportingCodes.length === 0 ? (
                  <span className="text-neutral-mid">—</span>
                ) : (
                  reportingCodes.map((code: string) => (
                    <QavanteBadge key={code} variant="info">
                      {code}
                    </QavanteBadge>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Unidad indexada</dt>
              <dd className="font-medium text-neutral-dark">{indexedLabel}</dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Fuente de tipo de cambio</dt>
              <dd className="font-medium text-neutral-dark">
                {settings.default_exchange_rate_source ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Última actualización</dt>
              <dd className="text-xs text-neutral-mid">{settings.updated_at}</dd>
            </div>
          </dl>
        </QavanteCard>
      </section>

      {tcPairs.length > 0 && (
        <section aria-labelledby="rates-heading" className="space-y-2">
          <h2 id="rates-heading" className="text-base font-semibold text-neutral-dark">
            Tipos de cambio
          </h2>
          <p className="text-sm text-neutral-mid">
            Tipo de cambio diario para convertir entre tu moneda funcional y las monedas de reporte.
            Si el SII u otra fuente aún no publicó el dato del día, lo verás como “Sin datos” —
            Qavante no inventa cifras.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tcPairs.map((p) => (
              <ExchangeRateCard key={`${p.base}>${p.quote}`} base={p.base} quote={p.quote} />
            ))}
          </div>
        </section>
      )}

      <CurrencySettingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        settings={settings}
        currencies={currencies}
      />
    </div>
  );
}
