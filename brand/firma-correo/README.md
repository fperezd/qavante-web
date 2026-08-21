# Firma corporativa Qavante para Outlook (qavante.com)

Firma de correo de la marca, en HTML apto para Outlook (tablas + estilos inline,
sin flex/grid, sin webfonts). Misma estructura que la firma de Tooxs —logo a la
izquierda, datos a la derecha, línea divisoria y pie corporativo— con la marca de
Qavante: azul `#051637` para los títulos y `#133E66` para los links. Fuente
Aptos, con el mismo stack que emite Outlook (`Aptos, Aptos_EmbeddedFont,
Aptos_MSFontService, Calibri, Helvetica, sans-serif`).

Campos de `personas.json`: `nombre`, `cargo`, `movil`.
No lleva línea de e-mail: el remitente ya la muestra (igual que la de Tooxs).

## Qué hay acá

| Archivo                 | Para qué                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `firma-completa.html`   | La firma. Va **solo** en mensajes nuevos (ver §3).                                                                 |
| `disclaimer-org.html`   | Bloque legal org-wide, se aplica desde Exchange a **todo** correo saliente. Complementa la firma, no la reemplaza. |
| `generar.py`            | Rellena las plantillas con los datos de cada persona.                                                              |
| `personas.example.json` | Formato del input. Copiar a `personas.json` (ignorado por git).                                                    |

## 1. Generar la firma de cada persona

```bash
cp personas.example.json personas.json   # editar con los datos reales
python generar.py personas.json
```

Deja `dist/<nombre>.html`.

## 2. Publicar el logo (una sola vez)

La firma apunta a `https://app.qavante.com/firma/qavante-logo-email.png`, que
sale de `public/firma/` de este repo. **Esa URL recién existe cuando `main` se
deploya a Cloudflare.** Verificar antes de repartir la firma:

```bash
curl -sI https://app.qavante.com/firma/qavante-logo-email.png | head -1
```

Debe responder `200`. Si da 404, el deploy todavía no salió.

No incrustar el logo como `data:` URI: Outlook de escritorio no lo renderiza.

## 3. Instalar en Outlook (por persona)

Microsoft Graph **no** expone la firma del buzón, así que este paso es manual
(o vía Exclaimer/CodeTwo si algún día se centraliza).

1. Abrir `dist/<nombre>.html` en el navegador.
2. Seleccionar todo (`Ctrl+A`) y copiar (`Ctrl+C`). Copiar lo **renderizado**,
   no el código.
3. Outlook → **Configuración → Correo → Redactar y responder → Firmas**.
4. Crear la firma `Qavante`, pegar (`Ctrl+V`) y guardar.
5. En **Firmas predeterminadas**, asignar la cuenta de `@qavante.com`:
   - _Mensajes nuevos_ → `Qavante`
   - _Respuestas y reenvíos_ → **(ninguna)**

La firma va **solo en mensajes nuevos**, a propósito. Si también se asigna a las
respuestas, un hilo de ocho intervenciones termina con ocho logos apilados: pesa
el correo, ensucia la lectura y en móvil obliga a hacer scroll sobre firmas
repetidas para llegar al texto. La firma cumple su función en el primer contacto;
de ahí en adelante el destinatario ya sabe quién eres.

Quien prefiera identificarse igual en las respuestas puede escribir su nombre a
mano al cerrar el mensaje — eso pesa cero y se lee mejor.

## 4. Bloque corporativo org-wide (opcional, requiere admin de M365)

Aplica a todo lo que sale de `qavante.com`, incluidos los que nunca configuran
su firma.

1. [Exchange Admin Center](https://admin.exchange.microsoft.com) → **Flujo de
   correo → Reglas → Agregar regla → Aplicar declinación de responsabilidad**.
2. Aplicar si: **El remitente es externo/interno** → _Dentro de la organización_
   negado, o bien condición por dominio del remitente `qavante.com`.
3. Pegar `disclaimer-org.html` en el texto, posición **Anexar**, reserva
   **Ajustar**.
4. Probar en modo **Solo probar** antes de activarla.

Límites de las reglas de Exchange: solo HTML plano (nada de `<table>`, `<style>`
ni `<img>`) y el bloque se anexa al final del mensaje, debajo del hilo citado.
Por eso la firma personal sigue siendo necesaria.

## Límites conocidos

- **Imágenes bloqueadas**: muchos clientes no bajan imágenes remotas hasta que el
  destinatario lo autoriza. El `alt` del logo dice "Qavante — Avanzar con
  inteligencia financiera", así que la firma se entiende igual.
- **Modo oscuro**: Outlook puede invertir los fondos. El logo es PNG con
  transparencia y el texto navy queda legible en ambos modos, pero conviene
  mirar una prueba real antes de repartirla al equipo.
- La firma **no** se aplica sola a correos que manda la aplicación (esos son
  transaccionales y salen por otro camino).
- La firma actual de Tooxs tiene el link de la web como `href="tooxs.com"`
  (relativo), y por eso algunos clientes lo muestran roto: `[tooxs.com]tooxs.com`.
  Acá va absoluto (`https://qavante.com`). Vale la pena arreglarlo también allá.
