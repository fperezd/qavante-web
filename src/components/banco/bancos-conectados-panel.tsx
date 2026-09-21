"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { api } from "@/lib/api/client";
import { QavanteEmpty } from "@/components/qavante";
import { BankLogo } from "@/components/banco/bank-logo";

export interface BankConnection {
  institution_id: string;
  institution_name: string;
  holder_id: string | null;
  holder_rut: string | null;
  holder_name: string | null;
  holder_type: string | null;
  status: string;
  mode: string | null;
  data_source: string;
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "connected") return "Conectado";
  if (normalized === "inactive") return "Inactivo";
  return status;
}

export function BancosConectadosPanel() {
  const [rows, setRows] = useState<BankConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<BankConnection[]>("/api/fintoc/connections")
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-neutral-mid">{error}</p>;
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

  return (
    <ul className="divide-y divide-neutral-light/80 overflow-hidden rounded-2xl border border-neutral-light bg-white">
      {rows.map((row) => (
        <li key={row.institution_id} className="flex items-start gap-3 px-4 py-4">
          <BankLogo institutionId={row.institution_id} name={row.institution_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-dark">{row.institution_name}</h3>
              <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                {statusLabel(row.status)}
              </span>
            </div>
            <dl className="mt-2 grid gap-1 text-sm text-neutral-mid sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:justify-start sm:gap-2">
                <dt>RUT</dt>
                <dd className="font-medium text-neutral-dark">{row.holder_rut ?? "—"}</dd>
              </div>
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
        </li>
      ))}
    </ul>
  );
}
