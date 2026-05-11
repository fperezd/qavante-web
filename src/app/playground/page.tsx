"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import {
  QavanteButton,
  QavanteInput,
  QavanteCard,
  QavanteBadge,
  QavanteEmpty,
  QavanteSourceTag,
  type QavanteSource,
} from "@/components/qavante";

const brand = [
  { label: "primary", className: "bg-brand-primary", hex: "#177FC6" },
  { label: "primary-50", className: "bg-brand-primary-50", hex: "#E8F2FA" },
  { label: "primary-100", className: "bg-brand-primary-100", hex: "#D1E5F4" },
  { label: "primary-600", className: "bg-brand-primary-600", hex: "#1268A6" },
  { label: "primary-700", className: "bg-brand-primary-700", hex: "#0D5286" },
];

const neutrals = [
  { label: "neutral-light", className: "bg-neutral-light", hex: "#C7C6C6" },
  { label: "neutral-mid", className: "bg-neutral-mid", hex: "#575756" },
  { label: "neutral-dark", className: "bg-neutral-dark", hex: "#1D1D1B" },
  { label: "surface", className: "bg-surface border border-neutral-light", hex: "#FFFFFF" },
];

const semanticos = [
  { label: "success-500", className: "bg-success-500", hex: "#10B981" },
  { label: "warning-500", className: "bg-warning-500", hex: "#F59E0B" },
  { label: "danger-500", className: "bg-danger-500", hex: "#EF4444" },
  { label: "info-500", className: "bg-info-500", hex: "#3B82F6" },
];

const pulso = [
  { label: "excelente", range: "851-1000", className: "bg-pulso-excelente" },
  { label: "saludable", range: "701-850", className: "bg-pulso-saludable" },
  { label: "estable", range: "501-700", className: "bg-pulso-estable" },
  { label: "vulnerable", range: "301-500", className: "bg-pulso-vulnerable" },
  { label: "crítica", range: "0-300", className: "bg-pulso-critica" },
];

const radios = [
  { label: "sm", className: "rounded-sm", value: "4px" },
  { label: "md", className: "rounded-md", value: "8px" },
  { label: "lg", className: "rounded-lg", value: "12px" },
  { label: "xl", className: "rounded-xl", value: "16px" },
];

const sombras = [
  { label: "sm", className: "shadow-sm" },
  { label: "md", className: "shadow-md" },
  { label: "lg", className: "shadow-lg" },
];

const tipografia = [
  { className: "text-xs", label: "text-xs · 12px" },
  { className: "text-sm", label: "text-sm · 14px" },
  { className: "text-base", label: "text-base · 16px" },
  { className: "text-lg", label: "text-lg · 18px" },
  { className: "text-xl", label: "text-xl · 20px" },
  { className: "text-2xl", label: "text-2xl · 24px" },
  { className: "text-3xl", label: "text-3xl · 30px" },
  { className: "text-4xl", label: "text-4xl · 36px" },
];

const sources: QavanteSource[] = [
  "sii",
  "sii-rcv",
  "sii-dte",
  "sii-bhe",
  "bice",
  "buk",
  "tgr",
  "previred",
  "manual",
];

function Swatch({ className, label, hex }: { className: string; label: string; hex?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-16 w-full rounded-md ${className}`} />
      <div className="text-xs font-medium text-neutral-dark">{label}</div>
      {hex && <div className="text-xs text-neutral-mid">{hex}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-neutral-dark">{title}</h2>
      {children}
    </section>
  );
}

export default function PlaygroundPage() {
  const [rut, setRut] = useState("");
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto max-w-6xl space-y-12 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-dark">Playground · Sistema de Diseño Qavante</h1>
        <p className="text-sm text-neutral-mid">
          Tokens del Anexo B.2 / B.4 (C0-06) + componentes Qavante capa 1 (C0-07).
          Validación visual del Documento Maestro v2.6.3.
        </p>
      </header>

      <Section title="QavanteButton · variantes y tamaños">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <QavanteButton variant="primary">Guardar</QavanteButton>
            <QavanteButton variant="secondary">Cancelar</QavanteButton>
            <QavanteButton variant="ghost">Ver detalle</QavanteButton>
            <QavanteButton variant="danger">Eliminar</QavanteButton>
            <QavanteButton variant="link">¿Olvidaste tu clave?</QavanteButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QavanteButton size="sm">sm</QavanteButton>
            <QavanteButton size="md">md</QavanteButton>
            <QavanteButton size="lg">lg</QavanteButton>
            <QavanteButton loading={loading} onClick={() => setLoading((l) => !l)}>
              {loading ? "Sincronizando…" : "Sincronizar ahora"}
            </QavanteButton>
            <QavanteButton disabled>Disabled</QavanteButton>
          </div>
        </div>
      </Section>

      <Section title="QavanteInput · text / number / currency / date / rut">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-mid">RUT (con validador)</label>
            <QavanteInput
              variant="rut"
              value={rut}
              onValueChange={setRut}
              placeholder="12.345.678-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-mid">Monto CLP</label>
            <QavanteInput
              variant="currency"
              value={monto}
              onValueChange={setMonto}
              placeholder="$0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-mid">Email (text)</label>
            <QavanteInput variant="text" placeholder="tu@empresa.cl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-mid">Fecha</label>
            <QavanteInput variant="date" />
          </div>
        </div>
      </Section>

      <Section title="QavanteCard · default / elevated / bordered">
        <div className="grid gap-4 sm:grid-cols-3">
          <QavanteCard variant="default" header="Caja proyectada" footer="Actualizado hoy">
            <p className="text-2xl font-bold text-brand-primary">$12.480.000</p>
            <p className="mt-1 text-xs text-neutral-mid">próximas 13 semanas</p>
          </QavanteCard>
          <QavanteCard variant="elevated" header="Pulso">
            <p className="text-2xl font-bold text-pulso-saludable">742</p>
            <p className="mt-1 text-xs text-neutral-mid">saludable</p>
          </QavanteCard>
          <QavanteCard variant="bordered">
            <p className="text-sm text-neutral-mid">Card sin header. Bordered.</p>
          </QavanteCard>
        </div>
      </Section>

      <Section title="QavanteBadge · 5 variantes">
        <div className="flex flex-wrap gap-2">
          <QavanteBadge>default</QavanteBadge>
          <QavanteBadge variant="success">conciliado</QavanteBadge>
          <QavanteBadge variant="warning">por revisar</QavanteBadge>
          <QavanteBadge variant="danger">vencida</QavanteBadge>
          <QavanteBadge variant="info">programada</QavanteBadge>
        </div>
      </Section>

      <Section title="QavanteEmpty · texto Anexo F.7">
        <QavanteEmpty
          icon={Banknote}
          title="Caja sin movimientos importados"
          description="Aún no tienes movimientos importados. Conecta tu Banco BICE para empezar a ver tu caja real."
          cta={<QavanteButton size="sm">Conectar Banco BICE</QavanteButton>}
        />
      </Section>

      <Section title="QavanteSourceTag · fuentes de datos">
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <QavanteSourceTag key={s} source={s} />
          ))}
        </div>
      </Section>

      <Section title="B.2.1 — Marca Qavante (paleta provisional)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {brand.map((c) => (
            <Swatch key={c.label} {...c} />
          ))}
        </div>
      </Section>

      <Section title="Neutrales + surface">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {neutrals.map((c) => (
            <Swatch key={c.label} {...c} />
          ))}
        </div>
      </Section>

      <Section title="B.2.2 — Semánticos (no negociables)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {semanticos.map((c) => (
            <Swatch key={c.label} {...c} />
          ))}
        </div>
      </Section>

      <Section title="B.2.3 — Bandas Pulso Empresa">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {pulso.map((p) => (
            <div key={p.label} className="flex flex-col gap-1">
              <div className={`h-16 w-full rounded-md ${p.className}`} />
              <div className="text-xs font-medium text-neutral-dark capitalize">{p.label}</div>
              <div className="text-xs text-neutral-mid">{p.range}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="B.3 — Tipografía Inter">
        <div className="space-y-2">
          {tipografia.map((t) => (
            <div key={t.className} className={`${t.className} text-neutral-dark`}>
              {t.label} · Qavante simplifica la gestión financiera de tu PYME chilena.
            </div>
          ))}
        </div>
      </Section>

      <Section title="B.4 — Radios">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {radios.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-2">
              <div className={`h-20 w-20 bg-brand-primary ${r.className}`} />
              <div className="text-xs font-medium text-neutral-dark">{r.label}</div>
              <div className="text-xs text-neutral-mid">{r.value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="B.4 — Sombras">
        <div className="grid grid-cols-1 gap-6 bg-background p-6 sm:grid-cols-3">
          {sombras.map((s) => (
            <div
              key={s.label}
              className={`flex h-24 items-center justify-center rounded-md bg-surface ${s.className}`}
            >
              <span className="text-sm font-medium text-neutral-dark">shadow-{s.label}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
