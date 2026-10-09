import type { IndustryTemplate } from "@/lib/api/industry-templates";

export type IndustryBusinessFamily = IndustryTemplate["business_family"];

/** Etiquetas en español para `business_family` (§13.3 del catálogo). */
export const INDUSTRY_FAMILY_LABELS: Record<IndustryBusinessFamily, string> = {
  general: "General",
  services: "Servicios",
  professional: "Profesionales y consultoría",
  technology: "Tecnología",
  commerce: "Comercio y ventas",
  production: "Producción e industria",
  construction_projects: "Construcción e ingeniería",
  hospitality: "Gastronomía y turismo",
  finance_investments: "Finanzas e inversiones",
  real_estate: "Inmobiliaria",
  logistics: "Logística y transporte",
  health_education: "Salud y educación",
  agriculture: "Agro",
  nonprofit: "Organizaciones",
  other: "Otros",
};

/** Orden de secciones en la UI (más genérico arriba). */
export const INDUSTRY_FAMILY_ORDER: IndustryBusinessFamily[] = [
  "general",
  "professional",
  "technology",
  "services",
  "commerce",
  "production",
  "construction_projects",
  "real_estate",
  "hospitality",
  "logistics",
  "health_education",
  "agriculture",
  "finance_investments",
  "nonprofit",
  "other",
];

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("es-CL");
}

export function filterIndustryTemplates(
  templates: IndustryTemplate[],
  query: string,
): IndustryTemplate[] {
  const q = normalizeQuery(query);
  if (!q) return templates;
  return templates.filter((t) => {
    const haystack = [
      t.name,
      t.description ?? "",
      t.code,
      INDUSTRY_FAMILY_LABELS[t.business_family],
    ]
      .join(" ")
      .toLocaleLowerCase("es-CL");
    return haystack.includes(q);
  });
}

export function sortIndustryTemplatesByName(templates: IndustryTemplate[]): IndustryTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export interface IndustryTemplateGroup {
  family: IndustryBusinessFamily;
  label: string;
  items: IndustryTemplate[];
}

export function groupIndustryTemplates(templates: IndustryTemplate[]): IndustryTemplateGroup[] {
  const byFamily = new Map<IndustryBusinessFamily, IndustryTemplate[]>();
  for (const t of templates) {
    const list = byFamily.get(t.business_family) ?? [];
    list.push(t);
    byFamily.set(t.business_family, list);
  }

  const groups: IndustryTemplateGroup[] = [];
  for (const family of INDUSTRY_FAMILY_ORDER) {
    const raw = byFamily.get(family);
    if (!raw?.length) continue;
    groups.push({
      family,
      label: INDUSTRY_FAMILY_LABELS[family],
      items: sortIndustryTemplatesByName(raw),
    });
    byFamily.delete(family);
  }

  for (const [family, raw] of byFamily) {
    groups.push({
      family,
      label: INDUSTRY_FAMILY_LABELS[family] ?? family,
      items: sortIndustryTemplatesByName(raw),
    });
  }

  return groups;
}

export function buildIndustryTemplateGroups(
  templates: IndustryTemplate[],
  query: string,
): IndustryTemplateGroup[] {
  return groupIndustryTemplates(filterIndustryTemplates(templates, query));
}
