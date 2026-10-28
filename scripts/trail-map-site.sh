#!/usr/bin/env bash
# Exports the web build and keeps, in site/, only what barry.support serves: the Adventure page, the email
# confirmation page and the static pages in web/. CI runs it on every push, and the Pages workflow publishes site/.
set -euo pipefail

npx expo export --platform web
rm -rf site
mkdir site
cp -R dist/adventure.html dist/confirmed.html dist/_expo dist/assets dist/fonts dist/favicon.ico site/
cp web/index.html web/404.html web/privacy.html web/terms.html web/site.css site/
cp assets/images/logo.png site/logo.png
