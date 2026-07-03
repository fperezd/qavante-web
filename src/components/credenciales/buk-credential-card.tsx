"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { useBukCredential, usePutBukCredential } from "@/lib/api/credentials";
import { PasswordInput } from "./password-input";

/* Token de BUK (Remuneraciones) — ADR-0056: el sync de planilla a Pagar necesita
   el api_token de BUK por tenant (sin fallback global). Card para cargar/rotar el
   token. El token NO se almacena en el FE (regla 6): se manda al backend cifrado. */

export function BukCredentialCard() {
  const { data, isLoading, isError, error } = useBukCredential();
  const put = usePutBukCredential();
  const [token, setToken] = React.useState("");

  const active = data?.is_active ?? false;

  function save() {
    const t = token.trim();
    if (!t) return;
    put.mutate({ api_token: t }, { onSuccess: () => setToken("") });
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
            Token de BUK
          </span>
          {!isLoading && (
            <QavanteBadge variant={active ? "success" : "default"}>
              {active ? "Configurado" : "No configurado"}
            </QavanteBadge>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid">
          {active
            ? "El token de BUK está configurado para esta empresa. Podés reemplazarlo si lo rotaste."
            : "Pega el token de la API de BUK de tu empresa para habilitar el registro de la planilla en Pagar. Lo guardamos cifrado; no queda en el navegador."}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PasswordInput
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={active ? "Pegar nuevo token para rotar" : "Pegar token de BUK"}
            autoComplete="off"
            aria-label="Token de BUK"
            className="flex-1"
          />
          <QavanteButton onClick={save} loading={put.isPending} disabled={token.trim() === ""}>
            {active ? "Reemplazar" : "Guardar token"}
          </QavanteButton>
        </div>

        {put.isSuccess && !put.isPending && (
          <p className="text-xs text-success-700">Token guardado. Ya podés registrar la planilla en Pagar.</p>
        )}
        {put.isError && (
          <QavanteInlineError error={put.error} what="el token de BUK" />
        )}
        {isError && <QavanteInlineError error={error} what="el estado de la credencial BUK" />}
      </div>
    </QavanteCard>
  );
}
