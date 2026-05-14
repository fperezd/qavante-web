# ADR-0006: SII credentials — decisiones de almacenamiento (placeholder)

- **Status:** Deferred — pending qavante-api backend input
- **Fecha:** 2026-05-13 (creación), pendiente fecha de Accepted
- **Decididores:** Fernando + CC-WEB + (futuro) equipo qavante-api
- **Tickets / PRs:** [#57](https://github.com/fperezd/qavante-web/issues/57), [#58](https://github.com/fperezd/qavante-web/pull/58) (contrato), PR de implementación FE (este ciclo).

## Contexto

`docs/backend-contracts/c1-sii-credentials.md` § 5 lista 3 decisiones arquitecturales que afectan cómo se implementan los 6 endpoints de credenciales SII en `qavante-api`:

1. Clave maestra de encriptación.
2. Storage del certificado PKCS#12.
3. Modelo de auditoría.

**Ninguna de las 3 impacta el frontend** — `qavante-web` no lee la clave maestra, no maneja el storage del cert (sólo sube el archivo binario), y no consume el audit log. Por eso este ADR vive en el repo FE como placeholder de coordinación, no como decisión propia.

Esta ADR existe para que cuando el equipo backend pida input o tome la decisión, haya un documento claro al que apuntar — y cuando se resuelva, se llene acá con la decisión final + rationale, y status pase a `Accepted`.

## Decisiones pendientes

### Decisión 1 — Clave maestra de encriptación

**Pregunta:** ¿con qué se encripta `tenant_credentials.company_sii_password_encrypted`, `.persons[i].password_encrypted`, `.certificate_pkcs12_encrypted`, `.certificate_password_encrypted`?

**Opciones:**

- **A. Fly secret** (`fly secrets set ENCRYPTION_MASTER_KEY=...`) — clave única, persistida fuera del codebase, accesible via `os.environ` en runtime de FastAPI. Rotación manual.
- **B. AWS KMS / Cloudflare KMS** — clave maestra gestionada por servicio cloud, audit trail automático, rotación gestionada. Costo extra + latency en cada operación de encrypt/decrypt.
- **C. Híbrido** — Fly secret + envelope encryption (DEK por tenant encriptada con clave maestra). Mejor security posture sin la latency de KMS por operación.

**Recomendación inicial (no vinculante):** A (Fly secret) para arrancar con <10 tenants, migrar a C (envelope) cuando auditoría externa lo exija. KMS puro es overkill hasta tener escala.

### Decisión 2 — Storage del certificado PKCS#12

**Pregunta:** ¿dónde vive el binario del cert (el `.pfx`/`.p12` encriptado)?

**Opciones:**

- **A. Columna `bytea` en Postgres** — simple, transaccional con el resto de las columnas del tenant, RLS aplicable directo. Certs reales son < 10 KB, no es problema de tamaño.
- **B. Cloudflare R2 / S3 bucket** — separación de concerns (blob storage para blobs), mejor para archivos grandes, pero rompe transaccionalidad con metadata en Postgres.
- **C. Backup en R2, primary en Postgres** — defensa en profundidad, mayor disponibilidad.

**Recomendación inicial (no vinculante):** A (Postgres bytea) — simplicidad gana hasta tener evidencia de bottleneck.

### Decisión 3 — Auditoría

**Pregunta:** ¿cómo se registran los eventos `credentials_rotated` / `certificate_uploaded` / `credentials_deleted`?

**Opciones:**

- **A. Tabla `tenant_audit_log`** con `(id, tenant_id, actor_user_id, event_type, payload_jsonb, created_at)`. Queryable, retención bajo control del backend, RLS aplicable.
- **B. Log estructurado** a Logflare / Cloudflare Logs / stdout JSON. Más cheap, menos queryable, retención del proveedor.
- **C. Ambos** — tabla para queries de compliance + log estructurado para observabilidad operacional.

**Recomendación inicial (no vinculante):** C (ambos) — defensa en profundidad, cada uno cubre un caso de uso diferente.

## Cuándo se resuelve

Cuando `qavante-api` arranca la implementación de #57 (issue cross-repo todavía no abierto al momento de este ADR). El equipo backend toma las 3 decisiones de su lado, las escribe acá (este archivo) actualizando con su decisión final + rationale + status `Accepted` + fecha real, y abre PR contra `qavante-web` para mergear el ADR cerrado.

Alternativamente: el equipo backend abre ADR análogo en su propio repo (`qavante-api/docs/adr/`) y este queda como pointer cross-repo. Si esa es la elección, este ADR pasa a status `Superseded by qavante-api/docs/adr/NNNN-...`.

## Acciones pendientes

- [ ] Fernando abre issue en `qavante-api` con link a `docs/backend-contracts/c1-sii-credentials.md` (este PR del FE asume que ese issue ya existe o existirá pronto).
- [ ] Equipo qavante-api decide las 3 cosas + llena este ADR (o el equivalente en su repo).
- [ ] Cuando esté decidido, status de este ADR pasa a `Accepted` + fecha real + actualizar [docs/adr/README.md](./README.md) índice.

## Referencias

- [docs/backend-contracts/c1-sii-credentials.md § 5](../backend-contracts/c1-sii-credentials.md) — las 3 preguntas en detalle.
- [#57](https://github.com/fperezd/qavante-web/issues/57) — issue origen de toda la línea de trabajo de credenciales SII.
- [#58](https://github.com/fperezd/qavante-web/pull/58) — PR del contrato (ya mergeado).
