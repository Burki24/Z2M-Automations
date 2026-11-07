# D0: dependency-free designer localization

As of 2026-11-07. Sources remain canonical in
Symcon_Z2MAutomations/Z2MAutomations/visualization. This repository contains no
UI fork, Electron executable or installed desktop application yet.

## Implemented

- Local JSON catalogs in locales/de.json and locales/en.json, stable message
  keys and named placeholders. No translation package, download or online API.
- Browser language supplies the default; saved manual selection takes precedence.
  English is the fallback. Pickers remain reachable inside open HTML dialogs.
- Text and presentation attributes update in place. Inputs, typed values,
  device search, channels, weekdays, step order, edited delays and scroll survive.
- Native Intl handles numbers, dates and plural forms. Names, scene names,
  IDs, MQTT values, rule times and time zones remain data.
- Native replies retain their text and add bounded presentation keys/parameters.
  Detailed validation uses the existing formatter in both languages, bound to
  its original job/context. Unknown provider text remains unchanged.
- A guarded audit endpoint receives only language codes and an open-editor flag.
  It logs German native debug, changes no draft and emits no MQTT.

## Reproduce in the canonical Symcon repository

~~~sh
npm run build:locales
npm run check:locales
node --import ./tests/locale-setup.mjs --test tests/designer-localization.test.mjs
php tests/designer.php
~~~

The build reproducibly generates locales.js and locales/messages.json; commit
both with their JSON sources. Checks reject missing keys, incompatible
placeholders, catalog markup, unknown view keys and stale artifacts.

The offline test tests/designer-localization.browser.mjs starts its own loopback
server and synthetic systems. Z2MA_PLAYWRIGHT_MODULE points to an existing
Playwright installation. It installs no dependency and contacts no real broker
or Symcon instance. It verifies open editing and subsequent synthetic draft
submission, defaults/fallback/preference, system separation, real mouse wheel
and 360/1920/3840-pixel layouts.

These are shared-designer checks on Windows, not desktop-platform acceptance.
A real Symcon/tile check after module update remains separate. No live system
was changed. D1 creates both desktop targets and extracts this designer once;
do not independently copy and evolve the UI or catalogs.
