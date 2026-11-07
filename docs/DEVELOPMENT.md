# Development

## Current scope

This repository initially contains the imported plan and development guidelines.
There is no `package.json`, lockfile or executable application/test/CI command yet.
Do not install dependencies or report a successful build at this stage. The
application checks below are requirements for the forthcoming skeleton.

## Documentation language

Write all repository documentation in English, including READMEs, project context,
plans, ADRs, development notes, code comments and API documentation. English is the
authoritative version. Keep localized application text in language catalogs;
German and English UI support remain part of the plan.

## Workflow

1. Review the request, [project context](../PROJECT_CONTEXT.md),
   [plan](DESKTOP_PLAN.md), relevant sources and working tree. Preserve user work.
2. Plan a bounded change with its Windows/Linux impact and suitable evidence.
3. Inspect existing components and helper contracts. Introduce abstractions only
   when the actual request warrants them.
4. Implement incrementally and run suitable existing checks. Regression tests
   verify observable behavior rather than implementation details.
5. Review the diff, UTF-8/LF, translations, provenance and absence of secrets.
6. Briefly report actual results and outstanding platform evidence. Supply English
   commit text; only the user commits and pushes, through GitHub Desktop.

Use working branch `dev` and primary branch `main`. Approved changes go through a
reviewed PR from `dev` into `main`, followed by synchronization back to `dev`.
Project creation does not authorize publication or automated release/signing actions.

## Tooling and code requirements for D1

- Verify Electron/Node/Forge/MQTT.js/i18next versions against official documentation
  before adoption. Pin compatible versions and the build environment; commit the
  lockfile. Do not invent versions or depend on unpinned daily builds.
- Enable strict TypeScript checking. Do not use `any` or unsafe casts instead of
  validating external IPC/MQTT/file data.
- Use consistent formatting and linting: two spaces, UTF-8 without BOM and LF.
  Use English technical identifiers and stable message keys.
- Add real, documented commands for type checking, linting, format checks, tests
  and builds with the package structure. Do not create empty green placeholder jobs.
- Later, use `npm ci` with the pinned lockfile. Explicitly review required lifecycle
  and native build steps; do not enable or suppress all such steps indiscriminately.
- Do not import `library.json`, Symcon module metadata, PHP stubs, StylePHP
  submodules or PHP check actions merely because the designer originated in Symcon.
- Decide application versioning, release workflow and licensing before the first
  package handoff. Do not derive an application version from the Symcon library.

## Required verification areas

| Area | Evidence required before completing the relevant feature |
| --- | --- |
| Business model | Schema, limits, device permissions, stable IDs, separate system drafts, conflicts and rollback |
| Localization | Complete DE/EN catalogs, matching parameters, fallback, plurals, numbers/dates and switching without input loss |
| Transport | Isolated synthetic MQTT/Z2M; request/session correlation, retained-message rejection, timeout, disconnect/reconnect and no command replay |
| IPC/renderer | Reject invalid senders and data; no raw publish/file/shell API; restrict navigation and external links |
| Diagnostics | Correlate public requests and decisions, remove secrets, bound recording and preserve its original end time |
| Editor | Create/edit/prefill, dialogs, search, system switches, long text, keyboard and drag and drop |
| Presentation | Light/dark, narrow/wide windows, scaling/DPI, mouse wheel and inner/outer scroll boundaries |
| Persistence | Atomic changes, backup/restore, corrupt files, different format versions and secret-free exports |
| Packages | Native installation, update, restart, uninstallation and data retention on both OS targets; signing and checksums before publication |

A passing unit/browser check does not establish acceptance of an installed desktop
application. Real brokers, physical device commands and restarts require a separate request.

## Platform matrix and CI

| Reference | Planned focus | Status |
| --- | --- | --- |
| Windows 11 x64 | Per-user installation, DPI, file locks, protected storage | Open; no application skeleton yet |
| Ubuntu Desktop 24.04 LTS x64 | `.deb`, secret service, Wayland/X11, paths and dependencies | Open; no native desktop evidence yet |
| Ubuntu Desktop 26.04 LTS x64 | Additional LTS acceptance run for the same release | Open; concrete environment still to be established |

Starting with D1, use separate Windows/Ubuntu jobs against the same source state.
Shared contract tests complement OS-specific builds. On Linux, verify case
sensitivity, unavailable/locked keyrings and file permissions; on Windows, verify
locked files and user paths. Do not hard-code developer paths or use shell commands
for file access. A WSL or headless run is not an Ubuntu desktop acceptance test.

Do not defer a failing platform while reporting both as complete. CI will also
check invalid UTF-8, corrupted characters and line endings. Preserve third-party
artifacts unchanged and explicitly exclude them from these checks. This automation
will be introduced with the skeleton and does not exist yet. Do not present a
Symcon ModuleCI PHP action as a desktop check.

## Reusing existing sources

Port existing PHP business logic to our own TypeScript logic only as needed;
shared synthetic cases verify equivalent contracts. D0 initially changes the
canonical designer in the separate Symcon repository and requires its own bounded
request and checks there. This setup imports no source code, distributes no
helpers and updates no modules.

During D1, extract the designer once and jointly verify package version,
provenance/checksums and Symcon integration. Continue consuming the Z2M extension
and schema as a verified artifact from their existing canonical source. The
application does not install host dependencies on Z2M.
