"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Clock3, Eye, Info, Settings, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  type CollectionReminderRule,
  type CollectionReminderRuleUpdate,
  useCollectionReminderSettings,
  useReceivableDocuments,
  useUpdateCollectionReminderSetting,
} from "@/lib/api/cobranza";
import { useCompanyScope } from "@/components/shell/company-scope";
import { cn } from "@/lib/utils";

type Kind = CollectionReminderRule["kind"];

const COPY: Record<Kind, { title: string; description: string; tone: string }> = {
  before_due: {
    title: "Recordatorio previo",
    description:
      "Tus clientes serán notificados antes del vencimiento de las facturas para reducir atrasos.",
    tone: "bg-neutral-100 text-neutral-dark",
  },
  due_today: {
    title: "Recordatorio de vencimiento",
    description:
      "Tus clientes serán notificados el día del vencimiento para mejorar la puntualidad de pago.",
    tone: "bg-warning-50 text-warning-800",
  },
  overdue: {
    title: "Recordatorio de mora",
    description:
      "Recupera pagos atrasados de forma automática y profesional, sin seguimientos manuales.",
    tone: "bg-danger-50 text-danger-800",
  },
};

export function RecordatoriosLive() {
  const settings = useCollectionReminderSettings();
  const { activeCompanyId } = useCompanyScope();
  const documents = useReceivableDocuments(activeCompanyId);
  const update = useUpdateCollectionReminderSetting();
  const [preview, setPreview] = React.useState<Kind | null>(null);
  const [editing, setEditing] = React.useState<CollectionReminderRule | null>(null);

  const save = async (kind: Kind, input: CollectionReminderRuleUpdate) => {
    try {
      await update.mutateAsync({ kind, input });
      toast.success("Configuración guardada");
      setEditing(null);
    } catch {
      toast.error("No pudimos guardar la configuración.");
    }
  };

  const toggle = (rule: CollectionReminderRule) =>
    void save(rule.kind, {
      enabled: !rule.enabled,
      days_offset: rule.days_offset,
      schedule_time: rule.schedule_time,
      audience_mode: rule.audience_mode,
      counterparty_keys: rule.counterparty_keys ?? [],
    });

  if (settings.isLoading)
    return <div className="h-[32rem] animate-pulse rounded-xl bg-neutral-100" />;
  if (settings.isError || !settings.data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-neutral-mid">
        No pudimos cargar los recordatorios.{" "}
        <button
          className="font-semibold text-brand-primary"
          onClick={() => void settings.refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl bg-gradient-to-br from-brand-primary via-[#6155e8] to-[#4338ca] p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3 text-white">
          <h2 className="text-lg font-bold">Plantillas automáticas</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-primary">
            <Sparkles className="size-3.5" /> Ahorra entre 4–6 horas semanales activándolas
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.data.items.map((rule, index) => (
            <ReminderCard
              key={rule.kind}
              rule={rule}
              className={index === 2 ? "lg:col-span-2 lg:mx-auto lg:w-[58%]" : undefined}
              onToggle={() => toggle(rule)}
              onPreview={() => setPreview(rule.kind)}
              onEdit={() => setEditing(rule)}
              pending={update.isPending}
            />
          ))}
        </div>
      </section>
      <PreviewDialog kind={preview} onClose={() => setPreview(null)} />
      <ConfigurationSheet
        rule={editing}
        customers={Array.from(
          new Map(
            /* `/documents` pagina: las contrapartes salen de TODAS las páginas traídas, no de
               la primera. Antes esto leía `data.items` de una respuesta única; con la lista
               paginada ese campo ya no existe y quedarse con `pages[0]` habría dejado el
               selector mostrando sólo las contrapartes de la primera página. */
            (documents.data?.pages ?? [])
              .flatMap((page) => page.items)
              .filter((item) => item.counterparty_key)
              .map((item) => [item.counterparty_key!, item.customer_name]),
          ).entries(),
        ).map(([key, name]) => ({ key, name }))}
        pending={update.isPending}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </>
  );
}

function ReminderCard({
  rule,
  className,
  onToggle,
  onPreview,
  onEdit,
  pending,
}: {
  rule: CollectionReminderRule;
  className?: string;
  onToggle: () => void;
  onPreview: () => void;
  onEdit: () => void;
  pending: boolean;
}) {
  const copy = COPY[rule.kind];
  const timing =
    rule.kind === "due_today"
      ? `A las ${rule.schedule_time.slice(0, 5)}`
      : `${rule.days_offset} días ${rule.kind === "before_due" ? "antes" : "después"} de vencer`;
  const audience =
    rule.audience_mode === "all"
      ? "Todas las empresas"
      : rule.audience_mode === "exclude"
        ? `Todas excepto ${rule.counterparty_keys?.length ?? 0}`
        : `Solo ${rule.counterparty_keys?.length ?? 0} empresas`;
  return (
    <article className={cn("overflow-hidden rounded-xl bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", copy.tone)}>
          {copy.title}
        </span>
        <div className="flex items-center gap-2 text-xs text-neutral-mid">
          <span>{rule.enabled ? "Activo" : "Sin activar"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            aria-label={`${rule.enabled ? "Desactivar" : "Activar"} ${copy.title}`}
            disabled={pending}
            onClick={onToggle}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              rule.enabled ? "bg-brand-primary" : "bg-neutral-300",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                rule.enabled ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-relaxed text-neutral-mid">{copy.description}</p>
      <div className="mt-4 rounded-lg bg-neutral-50 p-4">
        <p className="mb-3 text-sm font-semibold text-neutral-dark">Envío automático</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-mid">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4" />
            {timing}
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" />
            {audience}
          </span>
          <button
            type="button"
            onClick={onPreview}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-neutral-dark hover:bg-neutral-50"
          >
            <Eye className="size-4" />
            Ver correo
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-3 flex w-full items-center justify-center gap-2 border-t border-border pt-3 text-sm font-medium text-neutral-mid hover:text-brand-primary"
      >
        <Settings className="size-4" />
        Editar configuración
      </button>
    </article>
  );
}

function PreviewDialog({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  const title = kind ? COPY[kind].title : "";
  const heading =
    kind === "overdue"
      ? "Tienes un pago vencido"
      : kind === "due_today"
        ? "Tu pago vence hoy"
        : "Tienes pagos por vencer";
  return (
    <Dialog.Root open={kind != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/55" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 h-dvh w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-xl font-bold text-neutral-dark">
              Así se verá el correo de recordatorio
            </Dialog.Title>
            <Dialog.Close className="rounded p-2 hover:bg-neutral-100">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-neutral-mid">
            Vista previa de {title.toLocaleLowerCase("es-CL")}.
          </Dialog.Description>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-brand-primary-50 p-3 text-sm text-neutral-dark">
            <Info className="size-4 text-brand-primary" />
            Completaremos los datos con la información que corresponda.
          </div>
          <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="bg-[#f5f7ff] p-6">
              <p className="text-xl font-bold text-neutral-dark">{heading}</p>
              <span className="mt-2 inline-block rounded bg-[#ffe4f3] px-2 py-1 text-xs text-[#c12f82]">
                Folio del documento
              </span>
            </div>
            <div className="space-y-5 p-6 text-sm leading-relaxed text-neutral-mid">
              <p>
                Hola <Mark>nombre del cliente</Mark>,<br />
                Te recordamos el saldo pendiente del documento <Mark>folio</Mark>.
              </p>
              <div className="grid grid-cols-3 border-y border-border py-3 text-xs font-semibold text-neutral-dark">
                <span>Folio</span>
                <span>Vencimiento</span>
                <span className="text-right">Monto</span>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-[#ffe4f3] px-1 text-[#a92b72]">{children}</span>;
}

function ConfigurationSheet({
  rule,
  customers,
  pending,
  onClose,
  onSave,
}: {
  rule: CollectionReminderRule | null;
  customers: { key: string; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSave: (kind: Kind, input: CollectionReminderRuleUpdate) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<CollectionReminderRuleUpdate | null>(null);
  React.useEffect(() => {
    if (rule)
      setDraft({
        enabled: rule.enabled,
        days_offset: rule.days_offset,
        schedule_time: rule.schedule_time,
        audience_mode: rule.audience_mode,
        counterparty_keys: rule.counterparty_keys ?? [],
      });
  }, [rule]);
  if (!draft && !rule) return null;
  const set = <K extends keyof CollectionReminderRuleUpdate>(
    key: K,
    value: CollectionReminderRuleUpdate[K],
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  return (
    <Dialog.Root open={rule != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/55" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 flex h-dvh w-full max-w-2xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between p-6">
            <Dialog.Title className="text-2xl font-bold text-neutral-dark">
              Configuración de recordatorio
            </Dialog.Title>
            <Dialog.Close className="rounded p-2 hover:bg-neutral-100">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {rule && draft && (
            <>
              <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
                <Dialog.Description className="flex gap-2 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-dark">
                  <Info className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                  Este recordatorio estará activo mientras la factura siga pendiente de cobro, no
                  esté cedida y tenga un vencimiento confirmado.
                </Dialog.Description>
                <section>
                  <h3 className="font-semibold text-neutral-dark">Programación de envío</h3>
                  {rule.kind !== "due_today" && (
                    <label className="mt-5 grid gap-2 text-sm text-neutral-mid sm:grid-cols-[160px_120px_1fr] sm:items-center">
                      <span>Cuándo enviar:</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={draft.days_offset}
                        onChange={(event) => set("days_offset", Number(event.target.value))}
                        className="h-10 rounded-lg border border-border px-3 text-neutral-dark"
                      />
                      <span>días {rule.kind === "before_due" ? "antes" : "después"} de vencer</span>
                    </label>
                  )}
                  <label className="mt-4 grid gap-2 text-sm text-neutral-mid sm:grid-cols-[160px_120px_1fr] sm:items-center">
                    <span>Horario de envío:</span>
                    <input
                      type="time"
                      value={draft.schedule_time.slice(0, 5)}
                      onChange={(event) => set("schedule_time", event.target.value)}
                      className="h-10 rounded-lg border border-border px-3 text-neutral-dark"
                    />
                  </label>
                  <label className="mt-4 grid gap-2 text-sm text-neutral-mid sm:grid-cols-[160px_1fr] sm:items-center">
                    <span>Enviar desde:</span>
                    <input
                      disabled
                      value="Correo configurado en Qavante"
                      className="h-10 rounded-lg border border-border bg-neutral-100 px-3"
                    />
                  </label>
                </section>
                <section>
                  <h3 className="font-semibold text-neutral-dark">Audiencia</h3>
                  <div className="mt-4 space-y-3">
                    {(
                      [
                        ["all", "Todas las empresas"],
                        ["exclude", "Todas excepto:"],
                        ["include", "Solo para:"],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode} className="flex items-start gap-3 text-sm text-neutral-mid">
                        <input
                          type="radio"
                          name="audience"
                          className="mt-1"
                          checked={draft.audience_mode === mode}
                          onChange={() => set("audience_mode", mode)}
                        />
                        <span className="w-32 pt-0.5">{label}</span>
                        {mode !== "all" && (
                          <select
                            multiple
                            disabled={draft.audience_mode !== mode}
                            value={draft.audience_mode === mode ? draft.counterparty_keys : []}
                            onChange={(event) =>
                              set(
                                "counterparty_keys",
                                Array.from(event.target.selectedOptions, (option) => option.value),
                              )
                            }
                            className="min-h-24 flex-1 rounded-lg border border-border p-2 disabled:bg-neutral-100"
                          >
                            {customers.map((customer) => (
                              <option key={customer.key} value={customer.key}>
                                {customer.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-mid">
                    Usa Ctrl/Cmd para elegir más de una empresa.
                  </p>
                </section>
              </div>
              <div className="flex justify-end gap-3 border-t border-border p-5">
                <Dialog.Close className="rounded-lg px-6 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary-50">
                  Cancelar
                </Dialog.Close>
                <button
                  type="button"
                  disabled={
                    pending ||
                    (draft.audience_mode === "include" &&
                      (draft.counterparty_keys?.length ?? 0) === 0)
                  }
                  onClick={() => void onSave(rule.kind, draft)}
                  className="rounded-lg bg-brand-primary px-10 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
