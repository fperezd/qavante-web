"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { QavanteButton, QavanteEmpty } from "@/components/qavante";
import { BankLogo } from "@/components/banco/bank-logo";
import {
  connectionActionError,
  connectionsLoadError,
} from "@/components/banco/bancos-conectados-copy";
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

export function BancosConectadosPanel() {
  const { activeCompanyId } = useCompanyScope();
  const [rows, setRows] = useState<BankConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedBankId(null);
    setActionError(null);
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
        if (!cancelled) setError(connectionsLoadError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, retry]);

  const disconnect = async (row: BankConnection) => {
    const connectionId = row.id ?? row.link_id;
    if (!connectionId || !activeCompanyId) return;
    setActionError(null);
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
      setSelectedBankId(null);
      toast.success(`${row.institution_name} quedó desconectado. Tu historial se conserva.`);
    } catch (err) {
      const message = connectionActionError(err, "desconectar");
      setActionError(message);
      toast.error(message);
    } finally {
      setDisconnectingId(null);
    }
  };

  const deleteBank = async (row: BankConnection) => {
    if (!row.id || !activeCompanyId) {
      setActionError("Esta conexión antigua no tiene un identificador eliminable.");
      return;
    }
    setActionError(null);
    setDeletingId(row.id);
    try {
      const result = await api.delete<{
        deleted_accounts: number;
        deleted_movements: number;
      }>(`/api/fintoc/connections/${row.id}`, {
        headers: explicitCompanyRequestHeaders(activeCompanyId),
      });
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
      setSelectedBankId(null);
      toast.success(
        `${row.institution_name} eliminado${row.link_id && !row.link_id.startsWith("link_demo_") ? " de Qavante y Fintoc" : " de Qavante"}. ${result.deleted_movements} movimientos borrados.`,
      );
    } catch (err) {
      const message = connectionActionError(err, "eliminar");
      setActionError(message);
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
        description="Ve a Banco para conectar una institución a esta empresa. El acceso es de solo lectura."
      />
    );
  }

  const selectedBank = rows.find((row) => (row.id ?? row.link_id) === selectedBankId);
  const isBusy = Boolean(disconnectingId || deletingId);
  const selectedBankConnected = selectedBank?.status.toLowerCase() === "connected";

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
            <div className="ml-auto flex w-full shrink-0 self-stretch flex-col items-center justify-center gap-2 sm:w-56">
              {(row.id ?? row.link_id) && row.status.toLowerCase() === "connected" ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setSelectedBankId(row.id ?? row.link_id ?? null);
                  }}
                  className="w-44 rounded-full bg-neutral-dark px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Desconectar banco
                </button>
              ) : row.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setSelectedBankId(row.id ?? null);
                  }}
                  className="w-44 rounded-full border border-neutral-light px-4 py-2 text-center text-sm font-semibold text-neutral-dark"
                >
                  Gestionar historial
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Dialog.Root
        open={Boolean(selectedBank)}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setSelectedBankId(null);
            setActionError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-neutral-dark">
                {selectedBankConnected ? "Desconectar banco" : "Gestionar historial del banco"}
              </Dialog.Title>
              <button
                type="button"
                onClick={() => {
                  setSelectedBankId(null);
                  setActionError(null);
                }}
                disabled={isBusy}
                aria-label="Cerrar"
                className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <Dialog.Description className="text-sm leading-relaxed text-neutral-mid">
              {selectedBankConnected ? (
                <>
                  ¿Qué quieres hacer con <strong>{selectedBank?.institution_name}</strong> y sus
                  datos en Qavante?
                </>
              ) : (
                <>
                  <strong>{selectedBank?.institution_name}</strong> ya está desconectado. Puedes
                  conservar su historial o eliminarlo definitivamente.
                </>
              )}
            </Dialog.Description>
            <div className="mt-5 space-y-3">
              {selectedBankConnected ? (
                <div className="rounded-xl border border-neutral-light p-4">
                  <h3 className="text-sm font-semibold text-neutral-dark">
                    Desconectar y conservar historial
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-mid">
                    El enlace se elimina de Fintoc y se detiene la sincronización. Tus cuentas y
                    movimientos ya importados permanecen en Qavante.
                  </p>
                  <QavanteButton
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    disabled={isBusy}
                    loading={Boolean(disconnectingId)}
                    onClick={() => {
                      if (selectedBank) void disconnect(selectedBank);
                    }}
                  >
                    Desconectar y conservar
                  </QavanteButton>
                </div>
              ) : null}
              <div className="rounded-xl border border-danger-200 bg-danger-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-danger-700">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Eliminar banco e historial
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-mid">
                  El enlace se elimina de Fintoc y se borran permanentemente de Qavante las cuentas,
                  movimientos y datos de conciliación asociados. No podrás recuperarlos desde
                  Qavante.
                </p>
                <QavanteButton
                  type="button"
                  variant="danger"
                  className="mt-3"
                  disabled={isBusy || !selectedBank?.id}
                  loading={Boolean(deletingId)}
                  onClick={() => {
                    if (selectedBank) void deleteBank(selectedBank);
                  }}
                >
                  Eliminar definitivamente
                </QavanteButton>
              </div>
            </div>
            {actionError ? (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700"
              >
                {actionError}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <QavanteButton
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={() => {
                  setSelectedBankId(null);
                  setActionError(null);
                }}
              >
                Cancelar
              </QavanteButton>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
