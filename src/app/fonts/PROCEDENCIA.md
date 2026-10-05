# Tipografías del producto, versionadas en el repo

Estos archivos están acá para que **compilar no dependa de la red**.

Antes, `src/app/layout.tsx` y `.storybook/preview.tsx` las declaraban con
`next/font/google`, que **descarga la tipografía desde Google en tiempo de compilación**. Cuando
Google no responde, el job que compila muere entero:

    Failed to compile.
    An error occurred in `next/font`.
    TypeError: Cannot read properties of null (reading '1')
      .../next/dist/compiled/@next/font/dist/google/loader.js:122

Le tocaba a `lighthouse` o a `build` según el día, y en los dos casos el rojo no decía nada del
código del PR. Eso es lo caro: una vuelta de CI de este repo corre `build`, `e2e`, `storybook`,
`chromatic` y `lighthouse`, y un rojo que hay que aprender a ignorar es como se cuela un rojo de
verdad.

## Procedencia

Los `.woff2` salen de los paquetes `@fontsource/*` **5.3.0**, que publican los binarios de
Google Fonts con su licencia. Se extrajeron con `npm pack` (sin agregar la dependencia al
proyecto: sólo los archivos y su `LICENSE` entran al repo).

Las cuatro son **SIL Open Font License 1.1**, que permite redistribuirlas con el software. El
texto de cada una está en el `LICENSE` de su carpeta, sin modificar, como la OFL exige.

| Familia          | Carpeta             | Paquete                              | Licencia | Copyright                                                                                |
| ---------------- | ------------------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| Sora             | `sora/`             | `@fontsource/sora@5.3.0`             | OFL-1.1  | 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)                    |
| Figtree          | `figtree/`          | `@fontsource/figtree@5.3.0`          | OFL-1.1  | 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree)               |
| Spline Sans Mono | `spline-sans-mono/` | `@fontsource/spline-sans-mono@5.3.0` | OFL-1.1  | 2022 The Spline Sans Mono Project Authors (https://github.com/SorkinType/SplineSansMono) |
| Fraunces         | `fraunces/`         | `@fontsource/fraunces@5.3.0`         | OFL-1.1  | 2020 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces)            |

## Archivos y su sha256

Subconjunto `latin`, estilo `normal`, instancias **estáticas** por peso. Estáticas a propósito:
`next/font/google` con un array `weight` también servía estáticas, así que es lo que más se
parece a lo que la app renderizaba ayer. Sólo están los pesos que el producto declara; el resto
de la familia no se versiona.

| Familia          | Peso | Archivo                                                    | Bytes | sha256                                                             |
| ---------------- | ---- | ---------------------------------------------------------- | ----- | ------------------------------------------------------------------ |
| Sora             | 300  | `sora/sora-latin-300-normal.woff2`                         | 14940 | `3d1bb919fb7e9ff994c9d0792a3a12713869d88f6e9ec3df9209330f2f96a80e` |
| Sora             | 400  | `sora/sora-latin-400-normal.woff2`                         | 14724 | `98141d7eaa6e9ee35e0827d279018cd33c3e59c6650541ec7de1c692efd93942` |
| Sora             | 500  | `sora/sora-latin-500-normal.woff2`                         | 15056 | `edd010ebf2f4940b52d8b98296a499c0a783d838e427fa301c67f80959c1f441` |
| Sora             | 600  | `sora/sora-latin-600-normal.woff2`                         | 15000 | `fa9ab76f30510ad92153c6d6d72d0508884b85e9f0148abdfa963231b2a4845a` |
| Sora             | 700  | `sora/sora-latin-700-normal.woff2`                         | 15128 | `c3337a673c9bbbfe433091d3831714dd9a257951f16f41eb3fc650ec593cfac2` |
| Figtree          | 400  | `figtree/figtree-latin-400-normal.woff2`                   | 11384 | `8f98dd642986f1fa39c45b89665a57372897c235b36028e0e4a136e43dc5f8ab` |
| Figtree          | 500  | `figtree/figtree-latin-500-normal.woff2`                   | 11432 | `953a6a4294b1205a1b4d4b9e5529478e8c9e1c5a67a9aa24a551414cd85b6f51` |
| Figtree          | 600  | `figtree/figtree-latin-600-normal.woff2`                   | 11544 | `367d713287918784702563518f59239989da815c80d3c7337686b9816635a08b` |
| Figtree          | 700  | `figtree/figtree-latin-700-normal.woff2`                   | 11376 | `7ec4f08d09f91d349917dd6592f6aaae66d8fe1bbd58fa24707961e79236616e` |
| Spline Sans Mono | 400  | `spline-sans-mono/spline-sans-mono-latin-400-normal.woff2` | 12888 | `af7360e11effa088510c57bd6c327cacd1e53ce8b0f3ef1e2445284df777e5d6` |
| Spline Sans Mono | 500  | `spline-sans-mono/spline-sans-mono-latin-500-normal.woff2` | 12784 | `9179bba9265604145aefeea0ae786db5190893e0862c4b8236d90fa3fc2a4bcc` |
| Spline Sans Mono | 600  | `spline-sans-mono/spline-sans-mono-latin-600-normal.woff2` | 13048 | `86f91899eceb884d7faa8d175813ff28de090b218c3a627e9630f5aa953bd3e6` |
| Fraunces         | 400  | `fraunces/fraunces-latin-400-normal.woff2`                 | 17968 | `e558f39453a9c611908be04294b50dea5f21ae6c49b41c6e47f4115e91f90209` |
| Fraunces         | 500  | `fraunces/fraunces-latin-500-normal.woff2`                 | 18000 | `7975c1ef7caf89d0606dd985d35abe31a619c19262cf13f5a05938cc68fb27b2` |
| Fraunces         | 600  | `fraunces/fraunces-latin-600-normal.woff2`                 | 18096 | `3a1de7711d147bad4422825045f87597fd77cca72e7c96d3b0a81735d00dda82` |

Total: 15 archivos, ~218 KB. Para reproducir la verificación:

    npm pack @fontsource/sora@5.3.0   # y figtree, spline-sans-mono, fraunces
    tar xzf fontsource-sora-5.3.0.tgz
    sha256sum package/files/sora-latin-400-normal.woff2

## Cómo se usan

`next/font/local` en los dos sitios que antes llamaban a Google, con las MISMAS variables CSS
(`--font-sora`, `--font-figtree`, `--font-spline-mono`, `--font-fraunces`), los mismos pesos y
`display: swap`. Agregar un peso significa agregar su archivo acá y declararlo en los dos
lugares.
