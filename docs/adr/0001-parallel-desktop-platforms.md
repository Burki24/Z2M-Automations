# ADR 0001: Shared desktop application for Windows and Linux

- Date: 2026-11-07
- Status: Goals, product name and parallel platform development confirmed;
  application implementation and platform acceptance remain open.
- Derived from [Symcon ADR 0034](https://github.com/Burki24/Symcon_Z2MAutomations/blob/01f444d91d5c664177a5d2a60a5d644c72840523/docs/adr/0034-desktop-windows-linux-and-localization.md).

## Decision

Z2M-Automations is a standalone application built from a shared codebase for
Windows 11 x64 and Ubuntu Desktop LTS x64. Develop and verify both platforms in
parallel. Name the operating system explicitly in each edition. Other
Linux distributions, ARM64 and macOS are not promised initial targets.

The planned foundation is Electron, TypeScript, Electron Forge and MQTT.js.
Prepare German/English support in the existing designer first using locally
bundled catalogs; i18next is the planned translation library. Tauri remains an
alternative considered during planning but is not selected for the initial
shared approach because of the additional Rust/WebView work.

The desktop adapter uses direct MQTT connections through an isolated backend.
Symcon PHP, Symcon IDs and native action variables are not application prerequisites.
Actions require confirmed Z2M capabilities and write permissions. Automations
continue to run in our own external Z2M extension. The desktop application may
be closed after successful setup and activation.

## Source ownership

Until extraction, designer and extension sources remain canonical in the separate
`Symcon_Z2MAutomations` repository. Afterwards, this repository owns the shared
designer as a versioned package for both products. Do not maintain independent
UI copies or modified PHP helper copies. The extension and schema initially
remain canonical in the Symcon repository; the desktop application will consume
an explicitly identified, verified artifact.

The new application does not adopt Symcon event import without a Symcon adapter.
A local Symcon ownership mapping is not a global write lock against desktop
applications. Conflict detection requires fresh Z2M state.

## Consequences and boundaries

- Keep the renderer sandboxed, without Node integration, and expose restricted,
  validated IPC. MQTT, files and secrets stay in the desktop backend.
- Projects contain neither passwords nor private keys. Missing protected storage
  on Linux must not trigger a silent fallback to plaintext.
- Desktop license, initial version and distribution model remain explicitly open.
  Creating this project does not change the rights attached to existing sources.
- Retain general engineering, Git and private-data principles. Symcon module
  structures, PHP tools and Store requirements do not apply here.
- The operational agenda is [DESKTOP_PLAN.md](../DESKTOP_PLAN.md). Repository
  and guidelines are prepared; milestones D0–D7 are not implemented or accepted.
- Installation, broker connections, live changes and publication are outside
  the scope of this initial setup.
