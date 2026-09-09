#!/usr/bin/env bash

set -euo pipefail

# `ubuntu-latest` trae Chrome y, en algunas revisiones de la imagen, también
# deja habilitado su repositorio apt. Playwright ejecuta `apt-get update` para
# instalar las bibliotecas de su Chromium; si el índice de Google se publica a
# medias, ese update falla aunque Playwright no necesite dicho repositorio.
# La imagen oficial también retira estos dos archivos después de instalar
# Chrome. Limitamos la limpieza a esos nombres y dejamos que cualquier otro
# error de apt o Playwright termine el job.
sudo rm -f -- \
  /etc/apt/sources.list.d/google-chrome.list \
  /etc/apt/sources.list.d/google-chrome.list.save

exec npx playwright install --with-deps "$@"
