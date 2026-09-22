/* `next/font/google` baja CSS y woff2 en el build. En CI eso falla de dos
   formas: Turbopack 16.3 lo muestra como
   `@vercel/turbopack-next/internal/font/google/font`, y el loader de webpack
   hace `regex.exec(url)[1]` y revienta si la URL no termina en .woff2.
   Este mock solo lo usa el webServer de Playwright (`--webpack`). */

const fontFile = `${__dirname}/e2e-font.woff2`.replace(/\\/g, "/");
const css = `@font-face {
  font-family: "Qavante E2E";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${fontFile}) format("woff2");
}
`;

const urls = [
  "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Spline+Sans+Mono:wght@400;500;600&display=swap",
];

module.exports = Object.fromEntries(urls.map((url) => [url, css]));
