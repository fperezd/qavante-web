# Contrato OpenAPI consumido

`openapi.snapshot.json` es una copia **byte a byte** del snapshot que publica el productor
(`tooxs-digital/qavante-api`, `docs/contracts/openapi.snapshot.json`). Es el único acoplamiento
contractual de este repo con la API: `src/lib/api/types.ts` se genera desde este archivo, no desde
`https://api.qavante.com/openapi.json` (producción viva), y CI verifica que ambos coincidan (#298).

`openapi.snapshot.source.json` registra de dónde salió la copia:

| Campo        | Significado                                                                |
| ------------ | -------------------------------------------------------------------------- |
| `repo`       | Repo productor.                                                            |
| `ref`        | Rama o SHA que se pidió al sincronizar (normalmente `main`).               |
| `sha`        | Commit exacto del productor del que se copió el snapshot.                  |
| `path`       | Ruta del snapshot dentro del productor.                                    |
| `sha256`     | Digest del snapshot copiado; CI falla si el archivo local ya no lo cumple. |
| `fetched_at` | Cuándo se sincronizó (UTC).                                                |

## Comandos

| Comando                     | Qué hace                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run generate:api`      | Regenera `src/lib/api/types.ts` desde `openapi.snapshot.json` (local, determinista).                                                       |
| `npm run generate:api:sync` | Clona `--depth 1` el productor (`--ref` opcional, por defecto `main`), copia el snapshot, reescribe el sidecar y regenera `types.ts`.      |
| `npm run contract:check`    | Gate de CI: sidecar íntegro (`sha256`) y `types.ts` idéntico a lo que genera `generate:api` (`git diff --exit-code src/lib/api/types.ts`). |

## Flujo para consumir un cambio de contrato

1. El cambio se fusiona primero en `qavante-api` (`main`); su propio CI garantiza que el snapshot
   publicado no driftea de `app.openapi()`.
2. En este repo: `npm run generate:api:sync` (o `-- --ref <sha>` para fijar un commit concreto).
3. Revisar el diff de `types.ts` como lo que es: un cambio de contrato. Si cambia semántica
   financiera visible, moneda o auth, el PR es `risk:R2` (`docs/factory/PROJECT_POLICY.md`).
4. Commitear snapshot, sidecar y `types.ts` en el mismo PR. `contract:check` en CI falla si falta
   cualquiera de los tres o si alguien editó `types.ts` a mano.

Nunca editar `openapi.snapshot.json`, `openapi.snapshot.source.json` ni `src/lib/api/types.ts` a
mano. El snapshot está en `.prettierignore` a propósito: debe seguir siendo comparable byte a byte
con el del productor (`sha256sum`).
