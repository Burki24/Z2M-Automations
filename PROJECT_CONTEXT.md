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
package structure, dependencies, lockfile, application CI, installer or MQTT
connection has been implemented. No systems were contacted, installed or changed.

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
- Desktop license, initial application version and distribution model remain open.

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

## Next step

**D0 – Multilingual designer:** inventory existing text and message contracts,
implement German/English catalogs and switch languages without losing input.
This step initially affects the still-canonical designer sources in the Symcon
library and will be implemented separately. D1 then covers both desktop targets.

Repository setup completes only a prerequisite of D1. All milestones D0–D7 and
their platform acceptance checks remain open. Real Z2M/live tests, package
publication, commits and pushes are not part of this setup step.
