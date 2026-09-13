"use client";

import * as React from "react";
import { useDeferredDocuments } from "@/lib/api/document-actions";
import { toast } from "sonner";
import { useAccountsReceivable, useSendCollectionReminders } from "@/lib/api/cobranza";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import { ApiError } from "@/lib/api/errors";
import {
  isGestionado,
  readGestionado,
  withGestionado,
  withoutGestionado,
} from "../v2/cobrar-v2-map";
import { CobrarV04View } from "./cobrar-v04-view";
import type { ClienteV04 } from "./cobrar-v04-model";

/* Cableado de V04 · Cobrar. La vista es presentacional; acá se resuelven las dos fuentes:
 *
 *   · `GET /api/treasury/accounts-receivable` — total, vencido, aging, deudores y documentos
 *     vencidos (la MISMA función del backend que alimenta "Te deben" en V01 → Ley 1);
 *   · `GET/PUT /api/me/preferences` — el mapa `cobranza_gestionado` de Cobrar v2 (última gestión
 *     por cliente, el chip del crumb, y lo que el lote marca tras la cuenta regresiva).
 *
 * Bloquea la pantalla sólo `accounts-receivable`. Las prefs se esperan en la primera carga (sin
 * ellas el crumb diría "sin gestiones" sobre gestiones que sí existen) pero si FALLAN la pantalla
 * se pinta igual y registrar gestión responde diciendo qué falta (Ley 6). */

/** Fecha de HOY en America/Santiago como ISO "YYYY-MM-DD" (en-CA rinde ese formato; es el mismo
 *  sello que escribe Cobrar v2, así los dos mapas son compatibles). */
function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

/** Por qué no llegó el registro, en lenguaje de dueño. */
export function motivoSinRegistro(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el registro de cobranza (error de red). Vuelve a intentar en un momento.";
  }
  return "El registro de cobranza no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

export function CobrarV04Live() {
  const [hoy] = React.useState(() => new Date());
  const ar = useAccountsReceivable();
  const deferred = useDeferredDocuments("receivable");
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const reminders = useSendCollectionReminders();

  const gestionado = React.useMemo(() => readGestionado(prefs.data?.preferences), [prefs.data]);

  if (ar.isLoading || prefs.isLoading || deferred.isLoading) return <CargandoCobrar />;

  const sinPrefs = () =>
    toast.error("No pudimos guardar la gestión", {
      description: "No cargaron tus preferencias; recarga e intenta de nuevo.",
    });

  const toggleGestionado = (c: ClienteV04) => {
    if (!prefs.isSuccess) return sinPrefs();
    if (!c.rut) {
      toast.error("Este cliente no tiene RUT en el registro", {
        description: "Sin RUT no podemos guardar su gestión. Aparece igual en la tabla.",
      });
      return;
    }
    const antes = prefs.data.preferences;
    const ya = isGestionado(gestionado, c.rut);
    const blob = ya ? withoutGestionado(antes, c.rut) : withGestionado(antes, c.rut, hoyISO());
    update.mutate(blob, {
      onSuccess: () =>
        toast.success(ya ? `Reabriste a ${c.nombre}` : `Marcaste a ${c.nombre} como gestionado`, {
          action: { label: "Deshacer", onClick: () => update.mutate(antes) },
        }),
      onError: () => toast.error("No pudimos guardar el cambio."),
    });
  };

  /* El lote: UN solo PUT con los N marcados (el blob "reemplaza, no mergea", así que se encadenan
     los `withGestionado` sobre el mismo blob) y Deshacer restaura el blob anterior entero. */
  const marcarLote = (clientes: ClienteV04[]): boolean => {
    if (!prefs.isSuccess) {
      sinPrefs();
      return false;
    }
    const antes = prefs.data.preferences;
    const conRut = clientes.filter((c) => c.rut);
    if (conRut.length === 0) {
      toast.error(
        "Ninguno de estos clientes tiene RUT en el registro: no podemos guardar la gestión.",
      );
      return false;
    }
    const sello = hoyISO();
    const blob = conRut.reduce((acc, c) => withGestionado(acc, c.rut, sello), antes);
    update.mutate(blob, {
      onSuccess: () =>
        toast.success(
          `Marcaste a ${conRut.length} ${conRut.length === 1 ? "cliente" : "clientes"} como gestionados`,
          { action: { label: "Deshacer", onClick: () => update.mutate(antes) } },
        ),
      onError: () => toast.error("No pudimos guardar la gestión del lote."),
    });
    return true;
  };

  const copiar = async (texto: string): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Tu navegador no permite copiar automáticamente.");
      return false;
    }
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Recordatorio copiado", {
        description: "Pégalo en WhatsApp, correo o donde le escribas al cliente.",
      });
      return true;
    } catch {
      toast.error("No pudimos copiar. Intenta de nuevo.");
      return false;
    }
  };

  const enviarLote = async (receivableIds: string[], idempotencyKey: string) => {
    /* La vista crea la llave al iniciar la ventana de confirmación y conserva ESA misma llave si
     * falla la red y el dueño reintenta: así un 200 perdido no duplica un correo externo. */
    const respuesta = await reminders.mutateAsync({
      receivable_ids: receivableIds,
      idempotency_key: idempotencyKey,
    });
    return respuesta.items;
  };

  return (
    <>
      {deferred.isError && (
        <p role="alert" className="mb-3 text-sm">
          No pudimos cargar los seguimientos. Se muestran todos los documentos.{" "}
          <button onClick={() => void deferred.refetch()} className="underline">
            Reintentar
          </button>
        </p>
      )}
      <CobrarV04View
        deferredIds={deferred.data?.document_ids}
        ar={ar.data ?? null}
        arMotivo={ar.isError ? motivoSinRegistro(ar.error) : null}
        gestionado={gestionado}
        gestionDisponible={prefs.isSuccess}
        onToggleGestionado={toggleGestionado}
        onMarcarLote={marcarLote}
        onEnviarLote={enviarLote}
        onCopiar={copiar}
        onReintentar={() => void ar.refetch()}
        hoy={hoy}
      />
    </>
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoCobrar() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tus cuentas por cobrar y tus gestiones registradas (~5 s).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
