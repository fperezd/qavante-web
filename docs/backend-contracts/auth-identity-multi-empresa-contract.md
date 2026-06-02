# Contrato esperado — Identidad y multi-empresa (auth + sesión)

> **CC-WEB → CC-API. 2026-06-02.** Handoff del modelo de [ADR-0017](../adr/0017-modelo-identidad-multi-empresa.md)
> (Accepted). Define qué necesita el FE del backend para soportar **persona↔empresa
> N:M** con **empresa activa en sesión**. **No es Fase 2**: el SSO Google/MS sí lo
> es; esto es el modelo de datos + contrato de sesión que el MVP ya puede ir
> construyendo. Subdominio único `app.qavante.com` (no per-tenant) — ver
> [ADR-0003](../adr/0003-api-qavante-com-shared-parent.md).

## Modelo (resumen del ADR-0017)

- **Persona** = identidad, llave canónica **email**. Hoy RUT↔email es 1-1 (el RUT
  del login es de una persona). Login MVP sigue por **RUT + clave**; login-por-email
  llega con SSO en Fase 2, sin migración (el email ya es la llave).
- **Empresa** = tenant, identificada por **RUT**, creada en onboarding.
- **Membresía persona↔empresa = N:M.** Rol **por par (persona, empresa)**.
- **Empresa activa** vive en la **sesión server-side**; el FE no manda header por
  request. El backend **autoriza membresía en cada request** (defensa en profundidad).

## Lo que el FE necesita del backend

### 1. `POST /api/auth/login` (extender la respuesta)

Hoy setea la cookie de sesión. **Agregar al body de respuesta** (o a `/api/me`):

```jsonc
{
  "user": { "email": "fernando@tooxs.com", "name": "Fernando Pérez" },
  "companies": [
    { "id": "uuid|rut", "rut": "76.123.456-7", "name": "Tooxs SpA", "role": "owner" },
    { "id": "...", "rut": "77.987.654-3", "name": "Otra Empresa Ltda", "role": "viewer" },
  ],
  "active_company": "uuid|rut", // la última usada; null si es 1ra vez → FE elige
}
```

- `companies[]`: todas las empresas a las que la persona pertenece (puede ser 1..N).
- `role` es **por empresa** (owner/admin/editor/viewer — canónicos del Anexo C).
- `active_company`: id de la empresa activa por default (**última usada**); si no hay
  historial y hay >1, el FE muestra el selector.

### 2. `GET /api/me` (mismo shape)

Debe devolver `user` + `companies[]` + `active_company` para rehidratar el switcher
en cada carga (el FE no asume; lee del backend).

### 3. `POST /api/session/active-company` (nuevo)

```jsonc
// request
{ "company_id": "uuid|rut" }
// 200 → sesión actualizada (cookie re-emitida o sesión server mutada)
{ "active_company": "uuid|rut" }
// 403 si la persona NO pertenece a esa empresa
```

- Valida membresía; persiste la empresa activa en la sesión.
- A partir de acá, **todos los endpoints de negocio se scopean** a esa empresa.

### 4. Autorización por request (transversal)

Cada endpoint de negocio resuelve la empresa activa **desde la sesión** y **revalida
membresía** — nunca confía ciegamente. Si la sesión apunta a una empresa de la que la
persona ya no es miembro → 403.

## Notas / decisiones tomadas

- **Sin header `X-Company-Id`** ni subdominio por empresa — el scope va por la sesión.
- **Tradeoff aceptado:** una sola empresa activa por sesión (no 2 pestañas con empresas
  distintas). Deseable en un SaaS financiero.
- **Invitaciones:** el flujo `/(auth)/aceptar-invitacion` (FE ya existe) asocia un email
  a un RUT (crea una membresía). Contrato de invitación: handoff aparte cuando se priorice.
- **Onboarding:** la 1ra persona crea la empresa (RUT) y queda asociada como owner.

## Estado

- FE: el switcher de empresa (header, default última usada) se construye **detrás de
  flag** en cuanto exista este contrato. Hoy la sesión ya anticipa `tenant`
  (`src/lib/auth/session.ts`).
- BE: pendiente exponer los 3 puntos de arriba + la autz por request.
