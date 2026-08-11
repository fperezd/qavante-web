"use client";

import * as React from "react";
import { Copy, Check, KeyRound, Trash2, Plus, ShieldAlert } from "lucide-react";
import { QavanteCard, QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { formatDateLike } from "@/lib/formatters/date";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKeyCreateResponse,
} from "@/lib/api/api-keys";

/* Administración → MCP: conecta la empresa a un asistente LLM (ChatGPT/Claude) vía el server MCP de
   Qavante, y gestiona las API-keys de la empresa. La URL es fija (mcp.qavante.com); la auth es
   `Authorization: Bearer <tu-api-key>`. La key entera solo se ve UNA vez, al crearla. */

const MCP_URL = "https://mcp.qavante.com";

/** Roles disponibles para una key. Para un asistente conviene SOLO LECTURA (lee tus datos, no toca). */
const ROLES: { code: string; label: string }[] = [
  { code: "viewer", label: "Solo lectura (recomendado)" },
  { code: "accountant", label: "Contador" },
  { code: "finance_manager", label: "Gerente de finanzas" },
  { code: "external_advisor", label: "Asesor externo" },
  { code: "admin", label: "Administrador" },
  { code: "owner", label: "Dueño" },
];
const ROL_LABEL = new Map(ROLES.map((r) => [r.code, r.label]));

function CopyButton({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* clipboard bloqueado: no rompemos la pantalla */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-neutral-dark hover:bg-neutral-light/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      aria-label={`Copiar ${label}`}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-success-700" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">{label}</p>
        <p className="truncate font-mono text-sm text-neutral-dark">{value}</p>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function McpView() {
  const list = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();

  const [creando, setCreando] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [rol, setRol] = React.useState("viewer");
  const [nuevaKey, setNuevaKey] = React.useState<ApiKeyCreateResponse | null>(null);

  const crear = () => {
    create.mutate(
      { name: nombre.trim() || "Asistente", role_code: rol },
      {
        onSuccess: (resp) => {
          setNuevaKey(resp);
          setCreando(false);
          setNombre("");
          setRol("viewer");
        },
      },
    );
  };

  const keys = list.data?.items ?? [];
  const activas = keys.filter((k) => !k.revoked_at);

  return (
    <div className="space-y-4">
      {/* Cómo conectar */}
      <QavanteCard variant="bordered" header={<span className="font-medium">Cómo conectar</span>}>
        <p className="mb-3 text-sm text-neutral-mid">
          En tu asistente (ChatGPT o Claude), agrega un conector <b>MCP</b> con esta dirección y tu
          API-key como <b>Bearer</b>. El asistente va a poder leer tus datos de Qavante para
          responderte.
        </p>
        <div className="space-y-2">
          <Campo label="Dirección del servidor (MCP)" value={MCP_URL} />
          <Campo label="Autorización" value="Authorization: Bearer TU_API_KEY" />
        </div>
      </QavanteCard>

      {/* API-keys */}
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Tus API-keys</span>
            {!creando && !nuevaKey && (
              <QavanteButton size="sm" variant="ghost" onClick={() => setCreando(true)}>
                <Plus className="mr-1 h-4 w-4" /> Crear API-key
              </QavanteButton>
            )}
          </div>
        }
      >
        {/* Key recién creada: se muestra ENTERA una sola vez */}
        {nuevaKey && (
          <div className="mb-3 rounded-lg border border-success-700/30 bg-success-700/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-success-700">
              <ShieldAlert className="h-4 w-4" /> Copia esta key ahora: no se vuelve a mostrar.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
              <code className="break-all font-mono text-xs text-neutral-dark">{nuevaKey.key}</code>
              <CopyButton value={nuevaKey.key} label="API-key" />
            </div>
            <button
              type="button"
              onClick={() => setNuevaKey(null)}
              className="mt-2 text-xs font-medium text-neutral-mid hover:text-neutral-dark"
            >
              Ya la guardé
            </button>
          </div>
        )}

        {/* Form de creación */}
        {creando && (
          <div className="mb-3 space-y-2 rounded-lg border border-border p-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Nombre (para reconocerla)
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Asistente de finanzas"
                className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">
                Permiso
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {create.isError && (
              <p className="text-xs text-danger-500">No pudimos crear la key. Vuelve a intentar.</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <QavanteButton size="sm" variant="ghost" onClick={() => setCreando(false)}>
                Cancelar
              </QavanteButton>
              <QavanteButton size="sm" onClick={crear} loading={create.isPending}>
                Crear
              </QavanteButton>
            </div>
          </div>
        )}

        {/* Listado */}
        {list.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-neutral-light/30" aria-busy="true" />
        ) : activas.length === 0 && !nuevaKey ? (
          <p className="py-3 text-sm text-neutral-mid">
            Todavía no tienes API-keys. Crea una para conectar tu asistente.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        k.revoked_at ? "text-neutral-mid line-through" : "text-neutral-dark",
                      )}
                    >
                      {k.name}{" "}
                      <span className="font-mono text-xs text-neutral-mid">{k.key_prefix}…</span>
                    </p>
                    <p className="text-xs text-neutral-mid">
                      {ROL_LABEL.get(k.role_code) ?? k.role_code}
                      {" · "}
                      {k.revoked_at
                        ? "revocada"
                        : k.last_used_at
                          ? `usada ${formatDateLike(k.last_used_at)}`
                          : "sin usar todavía"}
                    </p>
                  </div>
                </div>
                {!k.revoked_at && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(k.id)}
                    disabled={revoke.isPending}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger-500 hover:bg-danger-500/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                    aria-label={`Revocar ${k.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revocar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QavanteCard>
    </div>
  );
}
