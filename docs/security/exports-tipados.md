# Exportación tipada para planillas

Las descargas construidas en el cliente de Banco, Cobrar, Pagar, Impuestos,
Presupuesto, Gestión (costos, comparativo y 360) y Libro SII usan XLSX.
La tabla intermedia conserva el tipo de cada celda antes de elegir el formato.
Un folio `000123` es texto; un monto negativo es número; una ausencia es celda
vacía. Los textos explícitos existentes, como `sin dato`, siguen siendo texto.
Libro SII deja vacíos los montos ausentes, que antes el export convertía en cero.

ExcelJS se importa dinámicamente al descargar. Los strings se asignan como
strings, nunca como objetos `formula` o `hyperlink`, ni como expresiones
`="..."`. Esto conserva literalmente `=`, `+`, `-`, `@`, caracteres full-width
y controles sin ejecutarlos. La dependencia tiene entrada browser; el build
con esbuild `--platform=browser --splitting` verifica su resolución para cliente.
El build de Next y presupuesto de bundle de CI siguen siendo gates.

## CSV interoperable

Los serializadores CSV conservan separador `;`, finales de línea y BOM único.
Texto peligroso lleva un apóstrofo literal. Ese prefijo forma parte del valor
del CSV. Las funciones CSV siguen disponibles para consumidores que requieren
ese formato. El endpoint del pivote de Gestión conserva `format=csv` como
contrato legacy para integraciones, pero la interfaz solicita `format=xlsx`.

## XLSX nativo de Gestión

El pivote principal no se reconstruye en el navegador. Gestión solicita el
XLSX tipado al endpoint canónico con la misma ventana y el mes proforma. El
cliente HTTP común conserva cookies, refresh single-flight, reintento y
`ApiError`. Antes de descargar, valida el MIME OOXML, la firma ZIP `PK`, el
`Content-Disposition` y el nombre contractual `.xlsx`. Si una de esas piezas
falta, muestra un error y no entrega al usuario un archivo plausible.

CSV no describe tipos de celda. Abrirlo directamente en Excel puede convertir
folios en números o fechas y decimales según el locale. Para importar CSV sin
esa inferencia hay que declarar las columnas como texto y el separador decimal
explícitamente. No se promete preservar tipos al guardar/reabrir CSV.

La prueba de descarte en Excel 16.0 (LCID 3082) mostró:

| Representación CSV    | Primera apertura                       | Guardar CSV y reabrir |
| --------------------- | -------------------------------------- | --------------------- |
| `000123` o `"000123"` | Número 123                             | Número 123            |
| `="000123"`           | Fórmula cuyo resultado es texto 000123 | Número 123            |
| Apóstrofo + `000123`  | Texto con apóstrofo visible            | Conserva el apóstrofo |
| Tab + `000123`        | Texto con tab incorporado              | Conserva el tab       |

Por eso la descarga para planillas usa XLSX y no modifica el identificador para
forzar la inferencia de un lector CSV.

## Reproducir el gate Excel

En PowerShell, con Excel instalado y únicamente datos sintéticos:

```powershell
$env:QAVANTE_XLSX_CORPUS = "$env:TEMP/qavante-export-corpus.xlsx"
npx vitest run --project unit src/lib/export/xlsx.test.ts
./scripts/test-xlsx-excel-roundtrip.ps1 -CorpusPath $env:QAVANTE_XLSX_CORPUS
```

El script crea una instancia oculta propia, abre el corpus, guarda una copia
XLSX y la reabre. Comprueba valores exactos, tipos de Excel y `HasFormula`.
La variable de entorno sólo genera un corpus cuando se solicita; no forma
parte del flujo de exportación de la aplicación.

Verificado en Excel 16.0 con configuración regional de Chile: folio `000123`
String exacto, `-0.5` y `0` Double, ausencia null y texto `=1+1` literal tras
ambas aperturas.

## Evidencia LibreOffice Calc

El mismo corpus pasó dos round-trips XLSX consecutivos con LibreOffice Calc
26.2.6.3, usando perfiles nuevos y aislados. La herramienta provino del MSI
oficial `LibreOffice_26.2.6_Win_x86-64.msi`, firmado válidamente por The
Document Foundation, con SHA-256
`F9877032FD908BEB9C0DDF06DF4AF5C2E85F419C42E14876C4CCE5AAE5FB2660`.

En ambos archivos guardados se verificaron diez filas: `000123` siguió siendo
texto exacto; `-0.5` y `0` siguieron siendo números; la ausencia quedó vacía;
la fecha mantuvo `2026-09-09`; y las entradas que comienzan con `=`, `+`, `-`,
`@`, sus variantes full-width y caracteres de control siguieron siendo texto.
El recuento de fórmulas fue cero.

Huellas de los tres artefactos conservados durante ese pase (no son hashes
deterministas de regeneración: XLSX incorpora timestamps en `docProps/core.xml`):

- corpus generado: `2E43DBBCF3ED32D0D0DA6001742D778AFF4DBADB149A47BB1A9DAD8615495431`;
- primer guardado Calc: `28C33B11D3131B4ED2528C18AFFE6B989C25F27911CF6282D5074D702A488059`;
- segundo guardado Calc: `10ED852F9C847E9E407B0E9CFFA299C4672C8D0D81C8EB1E585BA077EECF9DF5`.
