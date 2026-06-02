# ADR-0017: Modelo de identidad y multi-empresa (email como llave, persona↔empresa N:M, empresa activa en sesión, subdominio único)

- **Status:** Accepted
- **Fecha:** 2026-06-02
- **Decididores:** Fernando (producto) + CC-WEB (rol CTO)
- **Tickets / PRs:** este ADR (#293); handoff CC-API (ver Acciones)

## Contexto

El MVP autentica con `RUT + clave` (`POST /api/auth/login`); la sesión ya anticipa `tenant` ([`src/lib/auth/session.ts`](../../src/lib/auth/session.ts)). Hoy la relación RUT↔email es **1-1** (el RUT del login es de una persona).

Fernando define el modelo objetivo: la identidad es la **persona (email)**, con acceso futuro vía **Google/Microsoft SSO** (Fase 2); las personas se asocian a **empresas (RUT)** creadas en el onboarding; una persona puede pertenecer a **varias** empresas (socio de 3) y una empresa tener **varios** usuarios. El acceso es siempre por `app.qavante.com` — **no hay subdominio por empresa**.

Este ADR fija el modelo para ambos repos sin implementar Fase 2 (SSO está prohibido implementar ahora por CLAUDE.md).

## Decisión

### Identidad

- **El email es la llave canónica de una persona.** Una persona = un email. Mismo email por distintos métodos (clave, Google, Microsoft) = la misma persona; emails distintos = personas distintas.
- **Llave (email) ≠ input de login.** El input del MVP sigue siendo **RUT + clave** (resuelve 1-1 a la persona/email). El **login-por-email llega con SSO en Fase 2**, sin migración de datos (el email ya era la llave). No se toca el login del MVP ahora (no-regresión; cambiar el input es trabajo de backend sin ganancia funcional hoy). _(Confirmado por Fernando, 2026-06-02.)_

### Multi-empresa (tenancy)

- **Empresa = tenant, identificada por RUT**, creada en el onboarding ("primera configuración"): la persona creadora queda asociada y puede invitar otros emails (flujo `/(auth)/aceptar-invitacion`).
- **Membresía persona↔empresa es N:M.** Una persona en 1..N empresas; una empresa con 1..N usuarios.
- **El rol es por par (persona, empresa)** — owner en una, lector en otra. No hay rol global de persona. (Los planes definen límites de usuarios, más adelante.)

### Empresa activa y enrutamiento

- **Subdominio único `app.qavante.com`** para todos los tenants. El contexto de empresa NO va en el host. → Refuerza [[0003-api-qavante-com-shared-parent]] (cookie shared-parent `.qavante.com`); no cambia la estrategia de cookies.
- **La empresa activa vive en la sesión server-side.** Cambiarla = endpoint dedicado (ej. `POST /api/session/active-company { company_id }`) que el backend valida (membresía) y persiste en la sesión. Todos los requests de negocio quedan auto-scopeados por la empresa activa; el FE no adjunta header por request. _(Confirmado por Fernando, 2026-06-02.)_
- **Autorización de membresía en cada request** (defensa en profundidad): el backend nunca confía ciegamente en la sesión para el scope de empresa.
- **UI:** switcher de empresa **persistente en el header**, default a la **última usada**. Si la persona tiene una sola empresa, el switcher no estorba (se muestra sin acción de cambio).

## Alternativas consideradas

- **Login-por-email ya en el MVP (descartada por ahora):** cambia el contrato de `/api/auth/login` (backend) en la pantalla más crítica, sin ganancia hoy (RUT↔email 1-1) y SSO lo traerá igual. Diferida a Fase 2.
- **Empresa activa por header `X-Company-Id` en cada request (descartada):** más RESTful pero obliga al FE a adjuntarlo siempre; no aporta sobre la sesión dado el modelo de cookie httpOnly.
- **Subdominio por empresa (descartada por Fernando):** `app.qavante.com` único; nada de `empresa.qavante.com`.
- **Rol global de persona (descartada):** no modela al socio que es owner en una empresa y lector en otra.

## Consecuencias

### Positivas

- Identidad estable (email) desde el MVP → SSO de Fase 2 entra sin migración.
- Cero cambio en el login funcionando hoy (no-regresión).
- Modelo de tenancy claro y único para ambos repos; cookie shared-parent ya alineada.
- Scope de empresa centralizado en la sesión → menos superficie de error en el FE.

### Negativas / tradeoffs aceptados

- No se pueden tener dos empresas abiertas en dos pestañas a la vez (comparten sesión). Aceptable —y hasta deseable— en un SaaS financiero (evita cargar datos en la empresa equivocada).
- El switcher + selección de empresa activa son trabajo nuevo de FE **y** backend; no se puede construir hasta que el backend exponga membresías + endpoint de cambio.

### Acciones que destraba o requiere

- [x] **Handoff CC-API** documentado en [`docs/backend-contracts/auth-identity-multi-empresa-contract.md`](../backend-contracts/auth-identity-multi-empresa-contract.md): `/api/auth/login` y `/api/me` devuelven `companies[]` + `active_company`; nuevo endpoint `POST /api/session/active-company`; autz de membresía por request. (Falta: abrir issue cross-repo / nota en STATE_OF_THE_TRAIN — acción Fernando.)
- [ ] **FE:** switcher de empresa en el header (default última usada), detrás de flag, cuando el contrato exista.
- [ ] **Fase 2:** Google/MS SSO → login-por-email; el RUT-login puede quedar como método adicional o retirarse (sin migración de identidad).
- [x] Fernando confirma las dos recomendaciones CTO (login-input diferido; empresa activa en sesión) → ADR **Accepted** (2026-06-02).

## Referencias

- [[0003-api-qavante-com-shared-parent]] (cookie shared-parent, subdominio único)
- [[0015-coordinacion-cross-repo-issues-vs-state-of-the-train]] (handoff a CC-API)
- [`src/lib/auth/session.ts`](../../src/lib/auth/session.ts) (la sesión ya anticipa `tenant`)
- CLAUDE.md — SSO Google/MS es Fase 2 (prohibido implementar ahora); no-regresión
