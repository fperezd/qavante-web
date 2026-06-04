import { useMutation } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Asistente Qavante (Sprint C9, Anexo G). "Preguntar a Qavante":
   chat read-only en Fase 1.

   ⚠️ Contrato FE-FIRST. `POST /api/assistant/chat` AÚN NO existe en el backend.
   Tipos hand-rolled según el wire format de **ADR-0004** (separación
   reasoning/content). `generate:api` los reemplaza cuando el backend lo exponga.
   Gated por `assistant` (OFF en prod).

   SEGURIDAD (ADR-0004): el FE renderiza SOLO `content` + `tools_used` + `sources`.
   **Ignora cualquier otra clave** (defensa pasiva contra leaks de reasoning / API
   surface). NUNCA se llama al LLM desde el FE — solo vía este endpoint del backend
   (CLAUDE.md). El idioma de sesión viaja en `language` ("es-CL"). */

export interface AssistantMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantSource {
  /** "screen" | "doc" | ... — tipo de la fuente. */
  type: string;
  /** Ruta interna del FE o URL de doc para verificar. */
  url: string;
  label?: string | null;
}

/** Respuesta del backend. Solo estas 3 claves se tipan/renderizan (ADR-0004);
   `reasoning` y cualquier otra clave se ignoran a propósito. */
export interface AssistantResponse {
  /** Prosa natural en es-CL — lo único que se muestra como texto. */
  content: string;
  /** Nombres planos de tools (no firmas ni args) → chips "Consultando …". */
  tools_used: string[];
  /** Links opcionales a pantallas/docs para verificar. */
  sources: AssistantSource[];
}

export interface AssistantChatBody {
  messages: AssistantMessageInput[];
  /** Idioma de sesión; Fase 1 es-CL only (ADR-0004 regla 3). */
  language: string;
}

/** `POST /api/assistant/chat` — una pregunta + el historial → respuesta. NO retry
   (cada envío es una acción del usuario). */
export function useAssistantChat() {
  return useMutation({
    mutationFn: (body: AssistantChatBody) =>
      api.post<AssistantResponse>("/api/assistant/chat", { body }),
  });
}
