# Contrato esperado — Asistente Qavante / chat (Sprint C9)

> **CC-WEB → CC-API. 2026-06-04.** Contrato **FE-first**: el FE construyó el
> Asistente (`Preguntar a Qavante`, Anexo G) contra este contrato + MSW, **gated
> por `assistant` (OFF en prod)**. El endpoint **aún no existe**. El wire format
> y las reglas de seguridad están en **[ADR-0004](../adr/0004-asistente-qavante-anti-patterns.md)**
> (esta es su materialización FE). Tipos hand-rolled en `src/lib/api/assistant.ts`.

## Endpoint

`POST /api/assistant/chat`

- **Auth:** cookie `qavante_session` (sin `security: APIKeyHeader` — Brecha 0).
- **Request:**
  ```jsonc
  {
    "messages": [{ "role": "user", "content": "¿Cómo está mi caja este mes?" }],
    "language": "es-CL", // Fase 1 es-CL only (ADR-0004 regla 3)
  }
  ```
- **200** → `AssistantResponse`.

## Response shape (ADR-0004)

```jsonc
{
  "content": "Tu caja proyectada para abril es de $4,2M CLP.", // ÚNICO texto que se muestra
  "reasoning": "internal trace omitted from client response", // el FE lo IGNORA
  "tools_used": ["caja", "cobranza", "pulso"], // chips "Consultando …"
  "sources": [{ "type": "screen", "url": "/caja/proyeccion", "label": "Caja proyectada" }],
}
```

- **El FE renderiza SOLO `content` + `tools_used` + `sources`** y **ignora cualquier
  otra clave** (defensa pasiva contra leaks). `reasoning` vive solo en logs del backend.
- `tools_used`: nombres **planos** (no firmas ni args — nunca `tool(args)`).
- `sources[].url`: ruta interna del FE (`/caja/proyeccion`, `/cobrar`, …) o doc.

## Reglas duras del backend (ADR-0004 — recordatorio)

1. **Post-processor obligatorio** valida que `content` NO contenga `**Thinking:**`,
   `<thinking>`, `tool_name(...)`, nombre del modelo, ni el system prompt. Si los
   contiene → 500 + log de seguridad (no confiar ciegamente en el modelo).
2. **Read-only en Fase 1** (sin write tools).
3. **Idioma:** es-CL only; pedido de otro idioma → mensaje en es-CL apuntando a soporte.

## Notas

- Read-only: el chat NO ejecuta acciones, solo consulta y responde.
- Reutiliza las tools/cálculos del backend (pulso, caja, cobranza, resultado…).
- Endpoint para el flag (FLAG_GATING_ENDPOINT): `/api/assistant/chat`.
- Smoke (cuando exista): un prompt simple → la respuesta NO contiene `**Thinking:**`
  / `<thinking>` / `tool_name(` (ADR-0004 acciones).
