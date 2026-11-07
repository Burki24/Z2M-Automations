# Project context: Z2M-Automations

As of 2026-11-07. Repository: `Burki24/Z2M-Automations`; local path:
`E:\git\Z2M-Automations`. Permanent working branch: `dev`; primary branch: `main`.

## Request and actual state

The user has confirmed a shared Windows/Linux application, with Ubuntu LTS x64
as the first Linux reference platform. The user created the new project and
repository. The initial setup imports the existing plan and establishes the
development guidelines.

The repository contains the README, AGENTS, project context, architecture,
development workflow, ADR 0001 and text/ignore configuration. No application,
package structure, dependencies, lockfile, application build CI, installer or MQTT
connection has been implemented. A separate metadata workflow and dependency-free
project check now implement the usual automatic versioning from `0.1.0`; see
[VERSIONING.md](docs/VERSIONING.md). The new shared ModuleCI action needs approval
on `main` before the first consumer run. No systems were contacted or changed.

The operational agenda is [DESKTOP_PLAN.md](docs/DESKTOP_PLAN.md), imported from
`Symcon_Z2MAutomations` at planning commit
`01f444d91d5c664177a5d2a60a5d644c72840523`.
Maintain source references and progress in this repository from now on.
English is the primary language of all repository documentation; application
localization continues to target both German and English.

## Confirmed direction

- Product: Z2M-Automations for Windows / Z2M-Automations for Linux.
- Develop Windows 11 x64 and Ubuntu Desktop LTS x64 in parallel. Planned Ubuntu
  verification targets: 24.04 LTS and an additional acceptance run on 26.04 LTS.
  There is no practical-test evidence yet.
- Shared designer with German/English; planned foundation: Electron, TypeScript,
  Electron Forge and MQTT.js. Select versions when creating the skeleton.
- Up to eight systems, with multiple base topics on one or more brokers.
- Automations remain in our own Z2M extension, independently of the application.
- Desktop license and distribution model remain open. Initial application version:
  `0.1.0`, independent of the Symcon library.
- Translation uses local `de.json`/`en.json` catalogs and our own small resolver;
  no i18next or other translation runtime dependency.

## Source ownership and boundaries

`../Symcon_Z2MAutomations` is our existing Symcon library. Its designer and
extension initially remain canonical there. The planned extraction will move
UI ownership to `packages/designer` and provide a versioned package to Symcon.
The extension initially remains in the other repository. No UI, helper or
runtime copy was created during this setup.

Symcon event import and native object/action variables are not prerequisites
for the application. Its action permissions use the confirmed Z2M catalog.
Existing Symcon and device tests remain evidence for that product; they do not
establish desktop acceptance.

## D0 implementation

German/English localization is implemented in the still-canonical Symcon
designer using local JSON catalogs and our own dependency-free resolver.
Offline browser and native-hook checks cover switching with open input,
ordering, typed values, system separation, preferences and safe German debug.
See [LOCALIZATION.md](docs/LOCALIZATION.md) for the exact scope and commands.
No UI fork, desktop dependency or desktop executable was added here.

The version action is tested locally but is still absent from the checked
ModuleCI `main` revision. Follow [VERSIONING.md](docs/VERSIONING.md) before
claiming a successful consumer Actions run. Existing commit history is retained.

## Next step

**D1 – Both desktop targets:** establish the restricted Electron adapter and
extract the shared designer once. The implemented D0 UI remains in the Symcon
repository until that verified extraction. Its real module/tile update check
remains separate from the synthetic evidence.

Repository setup completes a prerequisite of D1. D1–D7 and native desktop
platform acceptance remain open. D0 has shared-source implementation and
synthetic evidence, not desktop-platform acceptance. Real Z2M/live tests,
publication, commits and pushes are not part of this change.
