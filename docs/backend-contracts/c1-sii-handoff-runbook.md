# Runbook — Handoff cross-agente credenciales SII (CC-WEB ↔ CC-API)

> Procedimiento paso a paso para coordinar la implementación de los 6 endpoints
> de credenciales SII entre **CC-WEB** (este repo, `qavante-web`) y **CC-API**
> (otro Claude Code en el repo backend `qavante-api`), con Fernando como puente
> humano entre ambos repos.
>
> **Por qué hace falta un puente:** CC-WEB no tiene acceso a `qavante-api` y
> CC-API no tiene acceso a `qavante-web`. Ningún agente ve el repo del otro.
> Fernando transporta artefactos y mensajes entre los dos.
>
> **Fuente de verdad:** [`c1-sii-credentials.md`](./c1-sii-credentials.md) — el
> contrato. Todo lo de acá lo referencia, no lo duplica.

---

## Estado al escribir este runbook (2026-05-15)

| Lado                                  | Estado                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| Contrato `c1-sii-credentials.md`      | ✅ completo, 6 endpoints + 10 restricciones + OpenAPI sugerido     |
| FE `/app/administracion/credenciales` | ✅ implementado, mockeado con MSW (PRs #58/#59)                    |
| Issue tracking FE                     | ✅ [#71](https://github.com/fperezd/qavante-web/issues/71) abierto |
| ADR-0006 (KMS/storage/audit)          | ⏳ `Deferred` — CC-API lo llena con su decisión                    |
| Backend `qavante-api` — 6 endpoints   | ❌ no implementados — **este handoff los destraba**                |
| Sprint C1 (ingesta sii_f29/previred)  | ❌ bloqueado hasta que el backend deploye                          |

---

## Los 6 pasos

### Paso 1 — Fernando: llevar el contrato al repo backend

CC-API no puede leer `qavante-web/docs/backend-contracts/c1-sii-credentials.md`.
Copiá ese archivo al repo `qavante-api` (sugerido: `docs/contracts/c1-sii-credentials.md`
o donde CC-API tenga sus contratos). Es un `.md` autocontenido — copy/paste del
archivo entero.

> Alternativa si no quieres duplicar el archivo: pegarle el contenido completo
> del contrato a CC-API como contexto en el primer mensaje. Pero tener el
> archivo versionado en el repo backend es mejor (CC-API lo re-lee cuando
> necesite, queda en su historial).

### Paso 2 — Fernando: darle el brief de arranque a CC-API

Abrí Claude Code en el repo `qavante-api` y pegale el brief de la
[sección "Brief para CC-API"](#brief-para-cc-api) de abajo. CC-API debería:

1. Leer el contrato.
2. Abrir/actualizar ADR-0006 en SU repo con las 3 decisiones pendientes
   (KMS vs Fly secret / Postgres bytea vs R2 / tabla audit vs log) — el
   contrato §5 trae recomendaciones iniciales.
3. Confirmarte el plan antes de codear (igual que hago yo acá).

### Paso 3 — CC-API: implementar + PR backend

CC-API implementa los 6 endpoints + encriptación + tablas + tests pytest,
según el DoD del contrato §7. Abre PR en `qavante-api`. Tú lo revisas/mergeas
igual que los míos.

**Punto de sincronización:** si CC-API encuentra una ambigüedad en el contrato
o necesita cambiar un shape, te lo dice → tú me lo traes a mí → yo ajusto el
contrato + los handlers MSW + los tipos del FE para que sigan alineados. El
contrato es bidireccional: si cambia, cambia en ambos lados.

### Paso 4 — CC-API: deploy a producción

El backend tiene que estar **deployado en `https://tooxs-gestion-api.fly.dev`**
con `/openapi.json` reflejando los 6 paths nuevos. No alcanza con que esté
mergeado en el repo backend — el FE regenera tipos desde la URL de prod.

Verificación rápida (la puedes correr tú o yo):

```bash
curl -s https://tooxs-gestion-api.fly.dev/openapi.json | grep -o "credentials/sii" | head -1
```

Si devuelve `credentials/sii` → los endpoints están live.

### Paso 5 — Fernando: avisarme "backend SII arriba"

Un mensaje tuyo a CC-WEB (yo): _"el backend de credenciales SII está deployado
en prod"_. Con eso disparo el Paso 6.

### Paso 6 — CC-WEB (yo): ejecutar el plan de integración FE

Ver [sección "Plan de integración FE"](#plan-de-integración-fe-post-handoff)
abajo. Es mecánico y lo ejecuto yo en un PR. Al terminar y mergear, **#71 se
cierra** y Sprint C1 (ingesta) queda destrabado.

---

## Brief para CC-API

> Texto listo para pegarle a Claude Code en el repo `qavante-api`. Ajustá la
> ruta del contrato al lugar donde lo copiaste en el Paso 1.

```
Hola CC-API. Necesito que implementes la familia de endpoints de
credenciales SII para destrabar Sprint C1 (ingesta F29/Previred).

El contrato completo está en docs/contracts/c1-sii-credentials.md (copiado
desde el repo qavante-web, es la fuente de verdad — CC-WEB ya tiene la UI
mockeada contra este contrato exacto vía MSW).

Antes de codear:

1. Leé el contrato entero. Son 6 endpoints REST + 10 restricciones de
   seguridad no-negociables (encriptación AES-256-GCM, nunca devolver
   passwords, tenant isolation, audit log, etc.).

2. Las 3 decisiones arquitecturales pendientes (contrato §5) resolvelas en
   un ADR-0006 en este repo backend:
   - Clave maestra de encriptación: KMS vs Fly secret.
   - Storage del cert PKCS#12: Postgres bytea encriptado vs R2.
   - Auditoría: tabla propia vs log estructurado.
   El contrato trae recomendaciones iniciales para cada una. Si las seguís,
   decilo en el ADR con rationale. Si te apartas, justificá.

3. DoD está en el contrato §7. Incluye tests pytest cubriendo casos felices,
   403 por rol insuficiente, 422 por cert inválido/expirado, y aislamiento
   por tenant (RLS).

4. CRÍTICO: el shape de las respuestas tiene que matchear EXACTAMENTE el
   contrato §2 y los modelos OpenAPI de §4. CC-WEB regenera sus tipos
   TypeScript desde tu /openapi.json — cualquier drift rompe el build del
   frontend. Si necesitas cambiar un shape, avisa a Fernando para que
   CC-WEB ajuste el contrato + sus mocks en paralelo (es bidireccional).

5. Al terminar: el backend tiene que estar deployado en
   https://tooxs-gestion-api.fly.dev con /openapi.json mostrando los 6
   paths nuevos. Avisa a Fernando cuando esté live en prod (no solo
   mergeado).

Dime tu plan antes de implementar.
```

---

## Plan de integración FE (post-handoff)

> Lo que ejecuto yo (CC-WEB) en el Paso 6, cuando el backend esté live en prod.
> Documentado acá para que sea reproducible y auditable, no improvisado.

1. **Regenerar tipos desde el OpenAPI real:**

   ```bash
   npm run generate:api   # openapi-typescript desde tooxs-gestion-api.fly.dev
   ```

   Esto reescribe `src/lib/api/types.ts` (archivo generado, nunca editado a mano).

2. **Reconciliar tipos hand-rolled vs generados.** Hoy `src/lib/api/credentials.ts`
   tiene tipos escritos a mano (`SiiCompanyStatus`, `SiiPersonStatus`,
   `CertificateStatus`, etc.) alineados al contrato. Tras regenerar:
   - Si el shape real == contrato → reemplazar los hand-rolled por los del
     schema generado. Cero cambios de lógica.
   - Si hay drift → es un hallazgo: lo documento, te aviso, y se decide si
     ajusta el backend (volver al contrato) o el contrato (aceptar el cambio
     real). No parcheo silenciosamente (CLAUDE.md regla 16).

3. **Typecheck:** `npx tsc --noEmit`. Si rompe, el drift del paso 2 es la causa
   — resolver antes de seguir.

4. **MSW handlers:** ajustar `src/test/msw/handlers.ts` (credenciales) sólo si
   hubo drift de shape. Los handlers se mantienen — siguen sirviendo para dev
   local sin backend + para los tests. No se borran.

5. **Quitar el modo mock por defecto del flujo real:** confirmar que sin
   `NEXT_PUBLIC_API_MOCKING=enabled`, el FE pega al backend real
   (`tooxs-gestion-api.fly.dev`). Documentado en CONTRIBUTING.md § "Cuando el
   backend baje".

6. **Smoke test E2E manual** (lo hace Fernando con credenciales reales, lo
   guío yo):
   - Login real → `/app/administracion/credenciales`.
   - Configurar clave SII empresa real → ver estado "Configurado".
   - Subir el certificado `.pfx`/`.p12` real + su clave → ver `expires_at`
     correcto + banner si aplica.
   - Agregar persona (contador) → rotar su clave → eliminar.
   - Verificar que ningún password vuelve en ningún response (DevTools
     Network — los `GET` solo traen `configured: bool` + metadata).

7. **Validar las 10 restricciones de seguridad del lado cliente** (contrato
   §1.3): sin storage APIs para los secrets, sin logs de campos sensibles,
   HTTPS-only. Las del lado backend (encriptación at rest, audit log) las
   valida CC-API en su DoD.

8. **Actualizar ADR-0006 a `Accepted`** en este repo (espejo de la decisión
   que CC-API tomó en el suyo), para que ambos repos cuenten la misma historia.

9. **Cerrar #71** con comentario de status + cerrar el loop en
   `CHANGELOG [Unreleased]` (mover de "Pendiente cross-team" a la sección del
   release que corresponda).

10. **Habilitar lo que estaba bloqueado:** con credenciales configurables,
    Sprint C1 ingesta `sii_f29` / `previred` queda desbloqueado del lado FE.

---

## Checklist de aceptación cross-repo

Antes de declarar el handoff completo, los dos lados verdes:

**Backend (`qavante-api`, valida CC-API + Fernando):**

- [ ] 6 endpoints implementados según contrato §2.
- [ ] Encriptación AES-256-GCM, clave maestra fuera del codebase.
- [ ] Tablas `tenant_credentials` + `tenant_audit_log`.
- [ ] Validación PKCS#12 (formato + password + `expires_at`).
- [ ] Tests pytest: happy path, 403, 422 cert inválido/expirado, RLS.
- [ ] ADR-0006 en `qavante-api` con status `Accepted` + rationale.
- [ ] Deployado en prod, `/openapi.json` muestra los 6 paths.

**Frontend (`qavante-web`, valida CC-WEB + Fernando):**

- [ ] `npm run generate:api` corre sin error, tipos regenerados.
- [ ] `npx tsc --noEmit` + `npm run lint` + `npm test` verdes.
- [ ] Tipos hand-rolled de `credentials.ts` reemplazados por generados (o
      drift documentado y resuelto).
- [ ] Smoke test manual con cert + clave reales pasa.
- [ ] Ningún password aparece en responses (verificado en Network).
- [ ] ADR-0006 espejado a `Accepted` en `qavante-web`.
- [ ] #71 cerrado, CHANGELOG actualizado.

---

Generated by CC-WEB — 2026-05-15.
