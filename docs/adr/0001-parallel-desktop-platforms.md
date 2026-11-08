# ADR 0001: Shared desktop application for Windows and Linux

- Date: 2026-11-07
- Status: Confirmed; D1 offline foundation and Windows/Ubuntu CI complete on
  2026-11-08. Later milestones and native installed-app acceptance remain open.
- Derived from [Symcon ADR 0034](https://github.com/Burki24/Symcon_Z2MAutomations/blob/01f444d91d5c664177a5d2a60a5d644c72840523/docs/adr/0034-desktop-windows-linux-and-localization.md).

## Decision

Z2M-Automations is a standalone application built from a shared codebase for
Windows 11 x64 and Ubuntu Desktop LTS x64. Develop and verify both platforms in
parallel. Name the operating system explicitly in each edition. Other
Linux distributions, ARM64 and macOS are not promised initial targets.

The planned foundation is Electron, TypeScript, Electron Forge and MQTT.js.
Prepare German/English support in the existing designer first using locally
bundled JSON catalogs and a small resolver of our own. The user explicitly
selected this dependency-free approach instead of i18next on 2026-11-07. Tauri remains an
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
- Owner decision on 2026-11-07: the desktop app uses PolyForm Noncommercial
  1.0.0; source notices and third-party licenses stay intact. Application
  versioning is independent and starts at 0.1.0; version.json is authoritative.
- Retain general engineering, Git and private-data principles. Symcon module
  structures, PHP tools and Store requirements do not apply here.
- The operational agenda is [DESKTOP_PLAN.md](../DESKTOP_PLAN.md). Repository
  and guidelines are prepared. D0 and the D1 offline foundation are implemented;
  D1 Windows/Ubuntu CI passed; native installed-app acceptance and later
  milestones remain open. See [D1 evidence](../D1.md).
- Installation, broker connections, live changes and publication are outside
  the scope of this initial setup.
