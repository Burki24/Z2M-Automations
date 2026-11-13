# Z2M-Automations

## Entry points and scope

- Read `PROJECT_CONTEXT.md`, `docs/DESKTOP_PLAN.md`, `docs/ARCHITECTURE.md`,
  `docs/DEVELOPMENT.md` and relevant ADRs before making changes.
- This repository contains the standalone desktop application for Windows and
  Linux. It is not a Symcon library and requires neither Symcon nor PHP at runtime.
- General engineering principles in the sibling `../SymconDevelopment/principles/`
  directory and relevant private-data and Git guidelines are references when
  available locally. The desktop rules in this file take precedence. Do not adopt
  Symcon-specific module structures, prefixes, PHP/StylePHP checks or Store rules.
- A missing sibling repository is not a runtime or build dependency. These rules
  also apply to a standalone clone.

## Documentation language

- English is the primary and authoritative language for all repository
  documentation: READMEs, project context, plans, ADRs, development guidelines,
  code comments and API documentation. Write new documentation in English and
  keep existing documentation in English when updating it.
- Use English technical identifiers, commit subjects and commit descriptions.
- This documentation policy does not remove localization requirements. The
  application must still support German and English through language catalogs;
  localized UI text belongs in those catalogs.
- Use local JSON catalogs and our own small resolver. Do not introduce i18next
  or another translation runtime dependency. Use platform `Intl` facilities.

## Goals and architecture

- Product and repository: `Z2M-Automations`. Explicitly name platform editions
  "for Windows" and "for Linux".
- Develop Windows 11 x64 and Ubuntu Desktop LTS x64 in parallel. Initially plan
  for Ubuntu 24.04 LTS and an additional acceptance run on 26.04 LTS. These are
  verification targets, not confirmed operating-system support.
- Use a shared codebase with TypeScript, Electron, Electron Forge, MQTT.js and
  our existing designer. Select final versions using current primary documentation
  when creating the application skeleton and pin them through a lockfile.
- Automations continue to run in our own Z2M extension. The application must be
  safe to close after successful setup.
- Support up to eight Z2M systems. Model brokers and base topics separately.
  Identify devices and rules through stable identifiers with explicit system
  ownership. Display names and paths are not substitute keys.
- Strictly separate the main process, preload and renderer. Keep credentials,
  MQTT clients, general file operations and shell access out of the renderer.
  IPC uses a limited allowlist with schema and sender validation.
- Coordinate schema/protocol changes with both management products. Preserve
  per-system revision, checksum, session, timeout and acknowledgement handling.

## Shared sources and third-party code

- Inspect suitable existing components and central helpers before implementation.
  Do not introduce PHP/Symcon helpers as desktop dependencies or modified copies.
- Designer sources are canonical in `packages/designer/src`. Both products
  consume this source through a versioned package; Symcon commits verified,
  pinned assets. Do not maintain two independent editable UI forks.
- The extension and schema initially remain canonical in the Symcon repository.
  The desktop application will consume a verified artifact with provenance,
  build identity and checksums; it must not create a separate runtime fork.
- Use our own implementation. Do not copy code, translated code or internal
  implementation structure from `Luligu/zigbee2mqtt-automations`. External
  documentation describes interfaces and is not an implementation template.
- The desktop application uses PolyForm Noncommercial 1.0.0, explicitly
  confirmed by the owner. Retain existing source notices. Third-party packages
  retain their respective licenses; do not replace them.

## Desktop visual identity

Use the desktop palette in `apps/desktop/renderer/desktop-palette.css` for
Windows and Linux. Apply its semantic tokens to the workspace, forms and app
dialogs. Keep the shared designer's embedded Symcon palette separate.
Native credential dialogs use the same colors where the toolkit supports
them. Respect OS high contrast and system-owned UI.

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#F4F1EC` | `#1B1918` |
| Surface | `#FFFCF7` | `#262321` |
| Secondary surface | `#EEE8DF` | `#302B28` |
| Border | `#D8CFC5` | `#554B45` |
| Strong border | `#87796E` | `#93847A` |
| Text | `#282321` | `#F7F0E8` |
| Secondary text | `#665C55` | `#C6B9AD` |
| Primary, success and action | `#3D7058` | `#A5C7AF` |
| Primary button text | `#FFFFFF` | `#17291F` |
| Primary hover | `#315D49` | `#B9D6C1` |
| Primary tint | `#E4EDE5` | `#293C31` |
| Trigger and keyboard focus | `#70416C` | `#D6A8CD` |
| Trigger tint | `#F1E4EF` | `#422F40` |
| Condition and warning | `#835514` | `#E6B76A` |
| Warning tint | `#F6EAD4` | `#44331F` |
| Error and destructive action | `#9F283F` | `#F0A6B1` |
| Error tint | `#FAE8EB` | `#482930` |
| Shadow | `#28232112` | `#00000040` |
| Backdrop | `#28232166` | `#00000099` |

Use text or symbols alongside semantic colors. Check readability and keyboard
focus in both themes. Keep the logo colors consistent in the header and the
Windows icon. Use Zigbee red `#E50E46` for the tile, `#F4F5F6` for the
connected Z, and forest green `#3D7058` for the play symbol.

## Interaction, localization and debug

- Support German and English from the start. Use stable message keys and
  parameters for visible text. An explicit language preference overrides the
  system default; English is the defined fallback. Use `Intl` for numbers,
  dates and plural forms.
- Preserve unsaved input across language changes, system switches and refreshes.
  Do not translate device names, IDs, MQTT values or YAML keys.
- Provide responsive layouts, light/dark themes, scalable text and complete
  keyboard access. Explicitly verify selects, dialogs, drag and drop, mouse-wheel
  handling and scroll boundaries.
- Debug output is mandatory. Make public requests, decisions and data flow
  traceable through structured events with system, request, rule, run and step
  identifiers. Displays and messages must support localization.
- Use one shared sanitization mechanism for diagnostics. Never log credentials,
  private device contents or complete automation files. Recording must be bounded
  and explicitly startable/stoppable. Saving or querying status must not extend
  its original end time.

## Data, testing and systems

- Visibly distinguish drafts, stored Z2M state and active operation. New rules
  and copies start disabled. Reading data does not start or stop anything.
- Compare against fresh Z2M state before writing; back up conflicts and show
  differences. Do not blindly repeat uploads, installation or device commands
  after a timeout or reconnection. Never retain control commands.
- Store secrets outside portable projects using OS-protected storage. Do not
  silently fall back to plaintext when a Linux secret service is unavailable.
- Use synthetic data and isolated peers in tests. Keep real brokers, private
  exports and production configurations out of the repository and CI.
- Live access, extension installation, restarts and real device commands require
  a separate, explicit practical-test request. Do not transfer authorization from
  earlier Symcon tests to this project.
- Run suitable checks as described in `docs/DEVELOPMENT.md`. Report results and
  limitations separately. A Windows pass does not establish Ubuntu acceptance.

## Working practices and Git

- Keep changes within the requested scope, preserve existing work and inspect
  the working tree first. Do not introduce speculative frameworks or placeholders.
- Use permanent development branch `dev` and primary branch `main`. Do not create
  separate Windows/Linux source branches. Integrate approved work from `dev` into
  `main`, then synchronize the approved state back to `dev`. Do not delete `dev`.
- Only the user commits and pushes, through GitHub Desktop. Provide an English
  commit subject and description after changes. Do not merge, release, sign or
  publish without a separate request.
- Use UTF-8 without BOM and LF as specified in `.gitattributes` and `.editorconfig`.
  Preserve third-party artifacts according to their source contracts.
- Keep documentation concise and accurate about the current state. A plan is
  neither an implementation nor practical-test evidence. Decide package/application
  versioning as described in `docs/VERSIONING.md`; do not continue Symcon library
  version numbers.
