"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Briefcase,
  Store,
  HardHat,
  Cpu,
  Factory,
  Building2,
  Bed,
  Wallet,
  Home,
  Truck,
  GraduationCap,
  Wheat,
  Heart,
  HelpCircle,
} from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton, QavanteEmpty } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useIndustryTemplates,
  useApplyIndustryTemplate,
  type IndustryTemplate,
  type ApplyTemplateResponse,
} from "@/lib/api/industry-templates";

/* Vista de Plantillas — Addendum §13/§14. Galería de plantillas por rubro
   con preview de "qué pasaría si aplico esto" (mode=suggest_only del §14.1)
   y aplicación confirmatoria (mode=add_missing). NUNCA destructivo: el
   botón principal hace SOLO suggest_only (preview); aplicar exige un
   dialog confirmatorio explícito.

   §14.1: ningún modo expuesto borra/pisa datos. `replace_visibility` queda
   fuera de scope — es más invasivo, decisión separada. */

/* Lazy: separa Base UI Dialog del First Load JS de /administracion/plantillas.
   Solo se descarga cuando el user pide aplicar (típicamente 1 vez). */
const ApplyTemplateDialog = dynamic(
  () =>
    import("./apply-template-dialog").then((m) => ({
      default: m.ApplyTemplateDialog,
    })),
  { ssr: false },
);

/* Mapping business_family → icono. 15 valores del enum cerrado del contrato. */
const FAMILY_ICON: Record<string, typeof Briefcase> = {
  services: Briefcase,
  professional: Briefcase,
  technology: Cpu,
  commerce: Store,
  production: Factory,
  construction_projects: HardHat,
  hospitality: Bed,
  finance_investments: Wallet,
  real_estate: Home,
  logistics: Truck,
  health_education: GraduationCap,
  agriculture: Wheat,
  nonprofit: Heart,
  general: Building2,
  other: HelpCircle,
};

const FAMILY_LABEL: Record<string, string> = {
  services: "Servicios",
  professional: "Profesional",
  technology: "Tecnología",
  commerce: "Comercio",
  production: "Producción",
  construction_projects: "Construcción / Proyectos",
  hospitality: "Hotelería",
  finance_investments: "Finanzas e inversiones",
  real_estate: "Inmobiliaria",
  logistics: "Logística",
  health_education: "Salud y educación",
  agriculture: "Agricultura",
  nonprofit: "Sin fines de lucro",
  general: "General",
  other: "Otro",
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

function ErrorState({ error, what }: { error: unknown; what: string }) {
  const message =
    error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function PreviewBox({ preview }: { preview: ApplyTemplateResponse }) {
  return (
    <div className="space-y-2 rounded-md border border-info-500/40 bg-info-500/5 p-3 text-sm">
      <p className="font-medium text-neutral-dark">
        Vista previa — aplicar plantilla{" "}
        <code className="rounded bg-neutral-light/40 px-1 py-0.5 text-xs">
          {preview.template_code}
        </code>
      </p>
      <ul className="space-y-1 text-neutral-mid">
        <li>
          <span className="font-medium text-neutral-dark">{preview.summary.accounts_to_add}</span>{" "}
          cuentas de gestión nuevas (
          <span className="text-neutral-mid">{preview.summary.accounts_existing} ya existen</span>)
        </li>
        <li>
          <span className="font-medium text-neutral-dark">{preview.summary.dimensions_to_add}</span>{" "}
          vistas de gestión nuevas (
          <span className="text-neutral-mid">{preview.summary.dimensions_existing} ya existen</span>
          )
        </li>
      </ul>
      <p className="text-xs text-neutral-mid">
        Esta es solo una vista previa — para aplicar, confirmá en el siguiente paso.
      </p>
    </div>
  );
}

function AppliedBox({ result }: { result: ApplyTemplateResponse }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-success-500/40 bg-success-500/10 p-3 text-sm text-neutral-dark"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" aria-hidden="true" />
      <p>
        Plantilla aplicada. {result.summary.accounts_to_add} cuentas y{" "}
        {result.summary.dimensions_to_add} vistas nuevas se agregaron a tu empresa.
      </p>
    </div>
  );
}

function TemplateCard({ template }: { template: IndustryTemplate }) {
  const apply = useApplyIndustryTemplate();
  const [preview, setPreview] = React.useState<ApplyTemplateResponse | null>(null);
  const [applied, setApplied] = React.useState<ApplyTemplateResponse | null>(null);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const Icon = FAMILY_ICON[template.business_family] ?? Building2;

  function handlePreview() {
    apply.mutate(
      { templateCode: template.code, body: { mode: "suggest_only", overwrite_existing: false } },
      { onSuccess: setPreview },
    );
  }

  function handleApplied(result: ApplyTemplateResponse) {
    setApplied(result);
    setPreview(null);
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>{template.name}</span>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <QavanteBadge variant="info">
            {FAMILY_LABEL[template.business_family] ?? template.business_family}
          </QavanteBadge>
          {!template.is_active && <QavanteBadge variant="default">Inactiva</QavanteBadge>}
        </div>
        {template.description && <p className="text-sm text-neutral-mid">{template.description}</p>}

        {applied ? (
          <AppliedBox result={applied} />
        ) : preview ? (
          <>
            <PreviewBox preview={preview} />
            <div className="flex flex-wrap gap-2">
              <QavanteButton size="sm" variant="ghost" onClick={() => setPreview(null)}>
                Descartar
              </QavanteButton>
              <QavanteButton size="sm" onClick={() => setApplyOpen(true)}>
                Aplicar plantilla
              </QavanteButton>
            </div>
          </>
        ) : (
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={handlePreview}
            disabled={apply.isPending}
          >
            {apply.isPending ? "Calculando…" : "Ver vista previa"}
          </QavanteButton>
        )}
        {apply.isError && !preview && !applied && (
          <p role="alert" className="text-sm text-danger-500">
            {apply.error instanceof ApiError
              ? apiErrorToUserMessage(apply.error)
              : "No pudimos calcular la vista previa."}
          </p>
        )}
      </div>

      {preview && (
        <ApplyTemplateDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          templateCode={template.code}
          templateName={template.name}
          summary={preview.summary}
          onApplied={handleApplied}
        />
      )}
    </QavanteCard>
  );
}

export function TemplatesGalleryView() {
  const templatesQuery = useIndustryTemplates();

  if (templatesQuery.isLoading) return <LoadingSkeleton />;
  if (templatesQuery.isError)
    return <ErrorState error={templatesQuery.error} what="las plantillas" />;

  const templates = templatesQuery.data?.items ?? [];

  if (templates.length === 0) {
    return (
      <QavanteEmpty
        icon={Layers}
        title="No hay plantillas disponibles"
        description="Cuando Qavante incorpore plantillas de rubro vas a poder elegir una acá."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-mid">
        Elegí una plantilla y ve qué cuentas y vistas de gestión sugiere Qavante para tu rubro. La
        vista previa no aplica nada — vas a poder confirmar antes (§14.1: nunca borramos ni pisamos
        datos).
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
