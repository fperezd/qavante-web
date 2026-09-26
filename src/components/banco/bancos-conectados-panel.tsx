"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { QavanteButton, QavanteEmpty } from "@/components/qavante";
import { BankLogo } from "@/components/banco/bank-logo";
import { useCompanyScope } from "@/components/shell/company-scope";
import { explicitCompanyRequestHeaders } from "@/lib/company/active-company";
import { formatDateLike } from "@/lib/formatters/date";

export interface BankConnection {
  id?: string | null;
  institution_id: string;
  institution_name: string;
  holder_id: string | null;
  holder_rut: string | null;
  holder_name: string | null;
  holder_type: string | null;
  link_id?: string | null;
  status: string;
  mode: string | null;
  data_source: string;
  connected_at?: string | null;
  created_at?: string | null;
  disconnected_at?: string | null;
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "connected") return "Conectado";
  if (normalized === "disconnected") return "Desconectado";
  if (normalized === "inactive") return "Inactivo";
  return status;
}

function formatDate(value: string | null | undefined): string | null {
  return value ? formatDateLike(value) : null;
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Tu sesión expiró. Inicia sesión nuevamente para ver tus conexiones.";
    if (error.status === 403)
      return "No tienes autorización para ver las conexiones de esta sociedad.";
    if (error.status === 0 || error.code === "network_error") {
      return "El servicio no está disponible. Intenta nuevamente en unos segundos.";
    }
    if (error.status >= 500)
      return "El servidor no pudo cargar las conexiones. Intenta nuevamente.";
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado al cargar las conexiones.";
}

export function BancosConectadosPanel() {
  const { activeCompanyId } = useCompanyScope();
  const [rows, setRows] = useState<BankConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteConfirmingId, setDeleteConfirmingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setDeleteConfirmingId(null);
    setDeleteError(null);
    if (!activeCompanyId) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    setError(null);
    api
      .get<BankConnection[]>("/api/fintoc/connections", {
        headers: explicitCompanyRequestHeaders(activeCompanyId),
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, retry]);

  const disconnect = async (row: BankConnection) => {
    const connectionId = row.id ?? row.link_id;
    if (!connectionId || !activeCompanyId) return;
    setDisconnectError(null);
    setDisconnectingId(connectionId);
    try {
      const updated = await api.post<BankConnection | undefined>(
        `/api/fintoc/connections/${connectionId}/disconnect`,
        { headers: explicitCompanyRequestHeaders(activeCompanyId) },
      );
      setRows(
        (current) =>
          current?.map((item) => {
            const itemId = item.id ?? item.link_id;
            if (itemId !== connectionId) return item;
            return (
              updated ?? {
                ...item,
                status: "disconnected",
                disconnected_at: new Date().toISOString(),
              }
            );
          }) ?? null,
      );
      setConfirmingId(null);
      toast.success(`${row.institution_name} quedó desconectado. Tu historial se conserva.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo desconectar este banco";
      setDisconnectError(message);
      toast.error(message);
    } finally {
      setDisconnectingId(null);
    }
  };

  const deleteBank = async (row: BankConnection) => {
    if (!row.id || !activeCompanyId) {
      setDeleteError("Esta conexión antigua no tiene un identificador eliminable.");
      return;
    }
    setDeleteError(null);
    setDeletingId(row.id);
    try {
      const result = await api.delete<{
        deleted_accounts: number;
        deleted_movements: number;
      }>(`/api/fintoc/connections/${row.id}`, {
        headers: explicitCompanyRequestHeaders(activeCompanyId),
      });
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
      setDeleteConfirmingId(null);
      toast.success(
        `${row.institution_name} eliminado${row.link_id && !row.link_id.startsWith("link_demo_") ? " de Qavante y Fintoc" : " de Qavante"}. ${result.deleted_movements} movimientos borrados.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar este banco";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <div role="alert" className="space-y-2 text-sm text-danger-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          className="font-semibold underline"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (!activeCompanyId) {
    return (
      <p className="text-sm text-neutral-mid">
        Selecciona una sociedad para ver sus conexiones bancarias.
      </p>
    );
  }
  if (rows == null) {
    return <p className="text-sm text-neutral-mid">Cargando bancos conectados…</p>;
  }
  if (rows.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="Todavía no hay bancos conectados"
        description="Usa Conectar banco para asociar una institución a esta empresa. El acceso es de solo lectura."
      />
    );
  }

  const bankToDelete = rows.find((row) => row.id === deleteConfirmingId);

  return (
    <>
      <ul className="divide-y divide-neutral-light/80 overflow-hidden rounded-2xl border border-neutral-light bg-white">
        {rows.map((row) => (
          <li
            key={row.id ?? `${row.institution_id}:${row.link_id ?? row.holder_rut ?? "legacy"}`}
            className="flex flex-wrap items-start gap-3 px-4 py-4 sm:flex-nowrap"
          >
            <BankLogo institutionId={row.institution_id} name={row.institution_name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-neutral-dark">
                  {row.institution_name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    row.status.toLowerCase() === "disconnected"
                      ? "bg-neutral-light text-neutral-mid"
                      : "bg-success-50 text-success-700"
                  }`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
              <dl className="mt-2 grid gap-1 text-sm text-neutral-mid sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                  <dt>RUT</dt>
                  <dd className="font-medium text-neutral-dark">
                    {row.holder_rut ?? "Sin información"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                  <dt>Identificador</dt>
                  <dd className="font-medium text-neutral-dark">
                    {row.link_id ?? row.id ?? "Sin información"}
                  </dd>
                </div>
                {formatDate(row.connected_at ?? row.created_at) ? (
                  <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                    <dt>Conectado</dt>
                    <dd className="font-medium text-neutral-dark">
                      {formatDate(row.connected_at ?? row.created_at)}
                    </dd>
                  </div>
                ) : null}
                {formatDate(row.disconnected_at) ? (
                  <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                    <dt>Desconectado</dt>
                    <dd className="font-medium text-neutral-dark">
                      {formatDate(row.disconnected_at)}
                    </dd>
                  </div>
                ) : null}
                {row.holder_name ? (
                  <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                    <dt>Titular</dt>
                    <dd className="truncate font-medium text-neutral-dark">{row.holder_name}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-1 text-xs text-neutral-mid">
                {row.data_source === "fintoc" ? "Conectado vía Fintoc" : "Conexión sandbox Qavante"}
                {row.mode ? ` · ${row.mode}` : ""}
              </p>
            </div>
            <div className="ml-auto flex w-full shrink-0 flex-col items-end gap-2 pt-1 sm:w-56">
              {(row.id ?? row.link_id) && row.status.toLowerCase() === "connected" ? (
                confirmingId === (row.id ?? row.link_id) ? (
                  <div className="self-stretch rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-dark">
                    <p className="font-semibold">¿Desconectar sólo {row.institution_name}?</p>
                    <p className="mt-1 text-xs">
                      Se detendrá la sincronización de este banco. Las cuentas y movimientos
                      históricos se conservan; otras conexiones no se modifican.
                    </p>
                    {disconnectError ? (
                      <p className="mt-2 text-xs text-danger-700">{disconnectError}</p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg px-3 py-1.5 font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void disconnect(row)}
                        disabled={disconnectingId === (row.id ?? row.link_id)}
                        className="rounded-lg bg-danger-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                      >
                        {disconnectingId === (row.id ?? row.link_id)
                          ? "Desconectando…"
                          : "Sí, desconectar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDisconnectError(null);
                      setConfirmingId(row.id ?? row.link_id ?? null);
                    }}
                    className="w-44 rounded-full bg-neutral-dark px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Desconectar banco
                  </button>
                )
              ) : null}
              {row.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteConfirmingId(row.id!);
                  }}
                  className="w-44 px-4 py-2 text-center text-sm font-semibold text-danger-700 underline underline-offset-2"
                  aria-label="Eliminar banco y su historial"
                >
                  Eliminar banco
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Dialog.Root
        open={Boolean(bankToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setDeleteConfirmingId(null);
            setDeleteError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-neutral-dark">
                <AlertTriangle className="h-5 w-5 shrink-0 text-danger-700" aria-hidden="true" />
                Eliminar banco y su historial
              </Dialog.Title>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmingId(null);
                  setDeleteError(null);
                }}
                disabled={Boolean(deletingId)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <Dialog.Description className="text-sm leading-relaxed text-neutral-mid">
              Esta acción eliminará <strong>{bankToDelete?.institution_name}</strong>
              {bankToDelete?.link_id && !bankToDelete.link_id.startsWith("link_demo_")
                ? " de Fintoc y "
                : " y "}
              borrará permanentemente de Qavante sus cuentas, movimientos y datos de conciliación
              asociados. No podrás recuperar este historial desde Qavante.
            </Dialog.Description>
            {deleteError ? (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700"
              >
                {deleteError}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <QavanteButton
                type="button"
                variant="ghost"
                disabled={Boolean(deletingId)}
                onClick={() => {
                  setDeleteConfirmingId(null);
                  setDeleteError(null);
                }}
              >
                Cancelar
              </QavanteButton>
              <QavanteButton
                type="button"
                variant="danger"
                loading={Boolean(deletingId)}
                onClick={() => {
                  if (bankToDelete) void deleteBank(bankToDelete);
                }}
              >
                Eliminar definitivamente
              </QavanteButton>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
