# Contrato backend — Credenciales SII + certificado digital (C1 prep)

> **⚠️ SUPERSEDED 2026-05-17 — este contrato `/api/credentials/sii` NO se
> implementó.** El backend shipeó un **modelo genérico de fuentes**
> (`/api/admin/sources/{source_code}/credential|test|consent|sync-config` +
> certificado vía `CertificateUploadRequest`/`CertificateMetadataResponse`).
> Fernando decidió la **Opción 1**: el FE se adapta al modelo genérico (es un
> superset que cubre todo lo de este contrato — ver
> [`reconciliation.md` P4-2](../addendum/reconciliation.md)). Este documento
> se conserva como **registro histórico del shape esperado** y referencia de
> los casos de uso (empresa, personas, certificado+expiry, consent), no como
> contrato vigente. Pregunta abierta a CC-API: representación del
> **multi-persona** SII en el modelo genérico.
>
> Documento que enumera los endpoints HTTP necesarios para almacenar y gestionar las credenciales SII (empresa + persona) y el certificado digital PKCS#12 que Qavante necesita para ingestar fuentes en Sprint C1+.
>
> **Pre-requisito de C1.** Sin estos endpoints + las credenciales cargadas por el tenant, el ingestor de F29/Previred no puede autenticarse contra el portal SII ni firmar requests digitalmente.
>
> **Origen:** [#57](https://github.com/fperezd/qavante-web/issues/57) — sesión del 2026-05-13 con Fernando, que identificó este requirement crítico previo a Sprint C1.

---

## 1. Contexto y restricciones

### 1.1 Por qué se necesita

El portal SII de Chile autentica contribuyentes con **RUT + Clave SII**. Para emitir documentos electrónicos firmados (factura electrónica, F29 ingresado programáticamente, etc.), se requiere **certificado digital PKCS#12** (`.pfx` o `.p12`) emitido por una entidad certificadora autorizada (E-Sign, E-Cert Chile, etc.).

Qavante actúa como cliente automatizado contra el portal SII en nombre del contribuyente: necesita custodiar estas credenciales con el mayor cuidado posible.

### 1.2 Modelo de datos conceptual

Cada **tenant** (empresa cliente de Qavante) tiene:

- **0 o 1** set de credenciales SII de la empresa (RUT empresa + clave). Normalmente 1.
- **N** sets de credenciales SII de personas autorizadas (RUT persona + clave). Típicamente 1-3 (dueño + contador externo + asistente).
- **0 o 1** certificado digital activo (PKCS#12 + clave). Normalmente 1.

Persistencia: una tabla `tenant_credentials` o equivalente, con columnas encriptadas para los secrets y metadata clara (RUT, fechas de expiración, último uso).

### 1.3 Restricciones de seguridad (no negociables)

1. **Encriptación at rest** — todas las claves SII + cert password en columnas encriptadas con AES-256-GCM. La clave maestra de encriptación NO vive en el codebase ni en `.env`; debe ser un secret de infra (Fly secret o KMS si se decide en ADR).
2. **Nunca devolver passwords** — los endpoints `GET` devuelven solamente el estado ("configurado" / "no configurado"), nunca el valor real de la clave. Hay zero endpoints que lean clear-text passwords.
3. **Transmisión HTTPS-only** — garantizado por Cloudflare Workers + Fly TLS. El backend rechaza requests sin TLS.
4. **Cero logs de campos sensibles** — los frameworks de logging deben tener filter para `password`, `clave`, `cert_password`, etc. Tanto FE como BE.
5. **Cero storage APIs en cliente** — CLAUDE.md regla 6. Las claves no pasan por `localStorage`, `sessionStorage`, `IndexedDB`, ni siquiera en memoria del cliente más allá del submit del form.
6. **Tenant isolation** — credenciales están scoped por `tenant_id`. RLS de C0-17 cubre el aislamiento a nivel DB. Defensa en profundidad: validar `tenant_id` en cada handler.
7. **Audit log** — registrar evento `credentials_rotated` / `certificate_uploaded` / `credentials_deleted` con `actor_user_id`, `timestamp`, `target_credential_type`, **sin contenido**. Útil para forense + compliance SII.
8. **Permisos** — sólo `owner` y `admin` (Anexo C.4) acceden a estos endpoints. `viewer`, `accountant`, `finance_manager` reciben 403.
9. **Certificado: validación al upload** — verificar que el archivo es PKCS#12 válido (`.pfx`/`.p12`), que la password destraba el cert sin error, y leer `notBefore`/`notAfter` para almacenar `expires_at`.
10. **Rotación de clave de encriptación** — soporte para re-encriptar las columnas con nueva clave maestra sin downtime. No es endpoint público; es operación batch del equipo backend.

### 1.4 Permisos canónicos

Para esta familia de endpoints:

| Rol                | Permiso                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `owner`            | ✓ todos los endpoints                                                   |
| `admin`            | ✓ todos los endpoints                                                   |
| `technical_admin`  | ✓ (rol Tooxs interno para soporte)                                      |
| `finance_manager`  | ✗ 403                                                                   |
| `accountant`       | ✗ 403 (acceso al portal SII vía su propia credencial, no la del tenant) |
| `viewer`           | ✗ 403                                                                   |
| `external_advisor` | ✗ 403                                                                   |

---

## 2. Endpoints

### 2.1 `GET /api/credentials/sii`

**Permiso:** `owner`, `admin`, `technical_admin`.
**Consumido por:** página `/app/administracion/credenciales` (C1 prep FE).

**Request:** sólo cookie de sesión.

**Response 200**

```json
{
  "company": {
    "configured": true,
    "rut": "76.123.456-7",
    "last_rotated_at": "2026-04-15T10:00:00Z"
  },
  "persons": [
    {
      "rut": "10.341.986-7",
      "name": "Fernando Pérez",
      "configured": true,
      "last_rotated_at": "2026-04-15T10:05:00Z"
    },
    {
      "rut": "12.345.678-9",
      "name": "Pablo Núñez",
      "configured": true,
      "last_rotated_at": "2026-05-01T14:00:00Z"
    }
  ],
  "certificate": {
    "configured": true,
    "subject_rut": "76.123.456-7",
    "expires_at": "2027-03-20T00:00:00Z",
    "uploaded_at": "2026-04-15T10:10:00Z"
  }
}
```

Si `company.configured = false`: omitir `rut` y `last_rotated_at`.
Si `persons` está vacío: `[]`.
Si `certificate.configured = false`: omitir `subject_rut`, `expires_at`, `uploaded_at`.

**Crítico — passwords nunca aparecen en este shape.**

**Response 403** — rol insuficiente.

---

### 2.2 `PUT /api/credentials/sii/company`

**Permiso:** `owner`, `admin`, `technical_admin`.

**Request body**

```json
{
  "rut": "76.123.456-7",
  "password": "<plaintext, política del backend>"
}
```

- `rut`: string con formato chileno válido. Backend valida con `isValidRut`. Debe coincidir con el `tenant.company_rut` si ya está seteado (no se permite cambiar el RUT empresa por este endpoint — eso es operación de mayor severidad, no en scope).
- `password`: plaintext, mínimo 4 caracteres (política SII real es laxa). Backend encripta antes de persistir.

**Comportamiento:**

1. Validar RUT match con `tenant.company_rut`.
2. Encriptar password con clave maestra del tenant.
3. Persistir en `tenant_credentials.company_sii_password_encrypted`.
4. Actualizar `tenant_credentials.company_last_rotated_at = now()`.
5. Registrar evento `credentials_rotated` en audit log con `target_credential_type = "company_sii"`.

**Response 204** — sin body.

**Errores:**

- `403` — rol insuficiente.
- `409 { "code": "rut_mismatch", "detail": "El RUT no coincide con el RUT empresa del tenant." }`.
- `422` — RUT mal formateado o password muy corta.

---

### 2.3 `PUT /api/credentials/sii/person`

**Permiso:** `owner`, `admin`, `technical_admin`.

**Request body**

```json
{
  "rut": "10.341.986-7",
  "name": "Fernando Pérez (opcional)",
  "password": "<plaintext>"
}
```

- `rut`: persona física.
- `name`: opcional, persistido si viene.
- `password`: plaintext, mínimo 4 caracteres.

**Comportamiento:**

- Si ya existe credencial para ese `rut` en el tenant → actualiza password (rotación).
- Si no existe → crea nueva entrada.
- Encripta + persiste + registra audit.

**Response 200** (creación) o **204** (rotación). Sin body sensible — confirmación de éxito.

**Errores:**

- `403` — rol insuficiente.
- `422` — RUT mal formateado, password muy corta.

---

### 2.4 `DELETE /api/credentials/sii/person/:rut`

**Permiso:** `owner`, `admin`, `technical_admin`.

**Request:** path param `rut`.

**Comportamiento:**

1. Buscar entrada `tenant_credentials.persons[rut]`.
2. Si no existe → 404.
3. Borrar (hard delete — la credencial debe desaparecer, no soft delete con encriptación residual).
4. Registrar audit `credentials_deleted` con `target_credential_type = "person_sii"`, `target_rut = rut`.

**Response 204** — sin body.

**Errores:**

- `403` — rol insuficiente.
- `404` — no existía credencial para ese RUT en el tenant.

---

### 2.5 `PUT /api/credentials/certificate`

**Permiso:** `owner`, `admin`, `technical_admin`.

**Request:** `multipart/form-data` con dos partes:

- `file`: archivo `.pfx` o `.p12` (PKCS#12 binario). Max 100 KB (los cert reales son ~3-5 KB; max generoso).
- `password`: clave del certificado (texto).

**Comportamiento:**

1. Validar Content-Type es `multipart/form-data`.
2. Leer file → verificar es PKCS#12 válido (parseo OpenSSL / equivalente).
3. Verificar que `password` destraba el cert (decrypt prueba).
4. Extraer del cert: `subject_cn`, `subject_rut` (campo `serialNumber` o equivalente), `notBefore`, `notAfter`.
5. Encriptar el cert binario + la password con clave maestra.
6. Persistir en `tenant_credentials.certificate_pkcs12_encrypted`, `.certificate_password_encrypted`, `.certificate_expires_at`, `.certificate_subject_rut`.
7. Si ya había certificado → reemplazar (no se versionan certificados; renovación es upload nuevo).
8. Registrar audit `certificate_uploaded` con `target_credential_type = "certificate"`, `expires_at`.

**Response 201** (primer upload) o **200** (reemplazo)

```json
{
  "certificate": {
    "configured": true,
    "subject_rut": "76.123.456-7",
    "expires_at": "2027-03-20T00:00:00Z",
    "uploaded_at": "2026-05-13T14:30:00Z"
  }
}
```

**Errores:**

- `403` — rol insuficiente.
- `422 { "code": "invalid_pkcs12", "detail": "El archivo no es un PKCS#12 válido." }`.
- `422 { "code": "invalid_certificate_password", "detail": "La clave no destraba el certificado." }`.
- `422 { "code": "certificate_expired", "detail": "El certificado ya expiró (vence YYYY-MM-DD)." }` — opcional pero recomendable rechazar.
- `413` — archivo > 100 KB.

---

### 2.6 `DELETE /api/credentials/certificate`

**Permiso:** `owner`, `admin`, `technical_admin`.

**Comportamiento:**

1. Si no hay cert configurado → 404.
2. Borrar columnas relacionadas (`certificate_pkcs12_encrypted`, `certificate_password_encrypted`, `certificate_expires_at`, `certificate_subject_rut`).
3. Registrar audit `credentials_deleted` con `target_credential_type = "certificate"`.

**Response 204** — sin body.

**Errores:**

- `403` — rol insuficiente.
- `404 { "code": "certificate_not_configured" }`.

---

## 3. Comportamiento UX esperado (frontend)

### 3.1 Visibilidad

- Ruta `/app/administracion/credenciales` está bajo el sidebar gate de PR #48 (`visibleFor: ["owner", "admin", "technical_admin"]`).
- Para roles sin permiso: el módulo Administración ya está oculto en el sidebar; si entran por URL directa, el backend devuelve 403 y la UI renderea el error de Anexo C.3.

### 3.2 Display

Cada bloque (empresa / persona / certificado) muestra estado:

- **No configurado** — CTA "Configurar [Empresa | Persona | Certificado]" en color brand-primary.
- **Configurado** — muestra metadata visible (RUT, fecha última rotación, vence) + acciones "Cambiar clave", "Eliminar".
- **Password nunca se muestra después de entrada** — ni siquiera asteriscos rellenos. El campo está vacío con placeholder "Cambiar clave" hasta que el user empieza a tipear.

### 3.3 Certificado: alertas de vencimiento

- ≤ 60 días: banner amarillo "Tu certificado digital vence en X días. Renová ahora para evitar interrupciones."
- ≤ 30 días: banner naranja con prioridad mayor + email automático al owner (cross-team con el sistema de notificaciones).
- ≤ 0 días: bloqueante — banner rojo + módulos que dependen del cert (Caja, Cobrar, Pagar) muestran error state hasta renovación.

### 3.4 Confirm dialogs

- "Eliminar credencial SII Empresa" / "Eliminar credencial persona X" / "Eliminar certificado": **siempre** modal de confirmación (destructive action, regla del Anexo F).
- Cambiar clave NO requiere confirm (es flujo de "set new value", no destructivo).

---

## 4. Modelos sugeridos (OpenAPI)

```yaml
SiiCredentialsStatus:
  type: object
  required: [company, persons, certificate]
  properties:
    company:
      $ref: "#/components/schemas/SiiCompanyStatus"
    persons:
      type: array
      items: { $ref: "#/components/schemas/SiiPersonStatus" }
    certificate:
      $ref: "#/components/schemas/CertificateStatus"

SiiCompanyStatus:
  type: object
  required: [configured]
  properties:
    configured: { type: boolean }
    rut: { type: string, nullable: true }
    last_rotated_at: { type: string, format: date-time, nullable: true }

SiiPersonStatus:
  type: object
  required: [rut, configured]
  properties:
    rut: { type: string }
    name: { type: string, nullable: true }
    configured: { type: boolean }
    last_rotated_at: { type: string, format: date-time, nullable: true }

CertificateStatus:
  type: object
  required: [configured]
  properties:
    configured: { type: boolean }
    subject_rut: { type: string, nullable: true }
    expires_at: { type: string, format: date-time, nullable: true }
    uploaded_at: { type: string, format: date-time, nullable: true }

SiiCompanyCredentialsBody:
  type: object
  required: [rut, password]
  properties:
    rut: { type: string }
    password: { type: string, minLength: 4, writeOnly: true }

SiiPersonCredentialsBody:
  type: object
  required: [rut, password]
  properties:
    rut: { type: string }
    name: { type: string }
    password: { type: string, minLength: 4, writeOnly: true }
```

`writeOnly: true` asegura que ningún client genere getters para el campo (refuerza la regla "nunca devolver passwords").

---

## 5. Pendientes de decisión arquitectural (probable ADR-0006)

Estos puntos NO están resueltos en este contrato y requieren decisión antes de implementar:

1. **Clave maestra de encriptación: KMS vs Fly secret.**
   - **Fly secret:** simple, gratuito, pero rotación manual y blast radius alto si se filtra.
   - **KMS (AWS / Cloudflare):** mejor security posture (rotación gestionada, audit trail, no expone clave bruta), pero costo + dependency externa.
   - Recomendación inicial: empezar con Fly secret + rotación manual documentada, migrar a KMS cuando haya >10 tenants o si auditoria externa lo exige.

2. **Storage del cert PKCS#12: ¿en Postgres encriptado o en R2 encriptado?**
   - **Postgres:** simple, transaccional, RLS aplicable directamente.
   - **R2:** mejor performance para archivos binarios, pero rompe transaccionalidad con metadata en Postgres.
   - Recomendación inicial: Postgres con columna `bytea` encriptada — los certs son < 10 KB, no justifica R2 hasta tener evidencia de bottleneck.

3. **Auditoría: tabla propia vs log estructurado.**
   - Tabla `tenant_audit_log` con `(tenant_id, actor_user_id, event_type, payload_jsonb, created_at)` permite queries de compliance.
   - Log estructurado a Logflare/Cloudflare Logs es más cheap pero menos queryable.
   - Recomendación: ambos — escribir a tabla + emitir log estructurado (defensa en profundidad).

Decisiones se toman en ADR-0006 antes del PR de implementación backend.

---

## 6. Pendiente FE (sigue después del merge de este contrato)

PR separado: `feat(c1-prep): UI Administración → Credenciales SII` con:

- Nueva ruta `/app/administracion/credenciales`.
- Componentes: `SiiCompanyCard`, `SiiPersonsList`, `CertificateCard`, formularios + dialogs.
- Hooks TanStack Query alineados a los endpoints de §2.
- Handlers MSW que implementen el contrato (db extendida con seed determinístico — sirve para dev + tests).
- Tests unit para los hooks + sanity tests sobre los handlers (igual que C0-15).

---

## 7. Acción esperada del backend

Crear issue en `qavante-api` titulado **"C1 prep: SII credentials + PKCS#12 storage"** con este documento como descripción (o link a este archivo). DoD del issue backend:

- [ ] 6 endpoints documentados acá implementados en FastAPI.
- [ ] Encriptación AES-256-GCM con clave maestra desde Fly secret (o KMS si ADR-0006 lo decide).
- [ ] Tabla `tenant_credentials` con columnas encriptadas + tabla `tenant_audit_log`.
- [ ] Validación PKCS#12 (formato + password destraba + lectura de expires_at).
- [ ] Tests pytest cubriendo: casos felices, rol insuficiente (403), formato cert inválido (422), cert expirado (422), tenant aislamiento (RLS).
- [ ] `/openapi.json` deployado refleja los nuevos paths.
- [ ] Frontend regenera tipos con `npm run generate:api` y compila sin tocar handlers MSW (los handlers se ajustan al diff si hay).
- [ ] Smoke test manual: cargar cert real de Fernando + clave SII real → poder leer status desde FE.

---

Generated by CC-WEB — 2026-05-13.
