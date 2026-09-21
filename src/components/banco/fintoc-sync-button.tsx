"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

interface FintocSyncResponse {
  status: string;
  accounts: number;
  imported: number;
}

export function FintocSyncButton() {
  const [loading, setLoading] = useState(false);

  const sync = async () => {
    setLoading(true);
    try {
      const result = await api.post<FintocSyncResponse>("/api/fintoc/sync");
      toast.success(`Fintoc: ${result.accounts} cuentas, ${result.imported} movimientos nuevos`);
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo pedir datos a Fintoc";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void sync()}
      disabled={loading}
      className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      {loading ? "Pidiendo datos a Fintoc…" : "Traer datos sandbox de Fintoc"}
    </button>
  );
}
