# Cambio externo pendiente — protección de main

Este PR publica los checks nuevos, pero no puede volverlos requeridos desde el repositorio.

Lectura verificada por API de GitHub el 2026-09-20:
`strict=true`, `enforce_admins=true`, sin force-push/delete, approvals=0, y
estos contexts requeridos: `lint`, `typecheck`, `test`, `build`, `e2e`,
`lighthouse`, `secrets-scan`, `dependency-audit`, `gate-review`,
`contract-drift`.

Antes de fusionarlo, el ejecutor publica estados locales sobre el head exacto y reemplaza esa lista por:

- `local-ci`;
- `local-change-evidence`;
- `local-security`;

y retirar los contexts actuales enumerados arriba. `local-ci` agrega contrato y
todas las suites aplicables por paths; `local-security` agrega secretos y dependencias.
Mantener strict/up-to-date, enforcement para administradores, sin force-push ni delete.

Orden seguro: publicar primero los tres estados locales verdes sobre el head, respaldar la configuración, reemplazar los contexts y releer la protección. Si la lectura no coincide, restaurar el respaldo.

Los estados se publican con `scripts/publish_local_gate.py`; el script exige árbol limpio, evidencia no vacía y GitHub Actions deshabilitado.

Chromatic no es required: GitHub Actions está deshabilitado. La cobertura visual aplicable se ejecuta localmente con Storybook/Chromatic cuando exista token, y `local-ci` conserva Storybook por paths.
