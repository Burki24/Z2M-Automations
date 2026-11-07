# Project context: Z2M-Automations

As of 2026-11-07. Repository Burki24/Z2M-Automations; working branch dev,
primary branch main. Product editions: Z2M-Automations for Windows / for Linux.

## Current state

D0 localization is implemented. D1 now provides a shared TypeScript/Electron/
Forge foundation: offline renderer, two synthetic systems, strict preload IPC,
local assets, DE/EN switching and bounded opt-in diagnostics. It contains no
MQTT connection, project persistence, credentials or device execution yet.
The complete desktop application uses PolyForm Noncommercial 1.0.0 by explicit
owner decision; existing designer notices are preserved.

Canonical UI ownership has moved to packages/designer/src. Symcon consumes an
explicit versioned archive with provenance and per-file hashes. Its tile,
helpers, native adapter and Z2M extension/schema remain in their original
repositories. No independent editable UI fork or sibling runtime dependency.

Windows compilation, real Electron smoke and packaged-app smoke have passed;
the Windows setup has been generated unsigned. Shared checks cover strict types,
invalid IPC/origins, read-only isolation, debug expiry and responsive themes.
Ubuntu CI targets the same source on 24.04. It has not run before push; native
Ubuntu acceptance, 26.04 and installed-app tests remain open. See docs/D1.md.
No Live system was contacted or changed.

## Versioning and next work

The automatic metadata action on Symcon_ModuleCI/main is operational. Run
42367039704 passed; bot commit 744fc251503047068bed507a6f84cd4457cf6cb8 set
version.json to 0.2.0. Builds read that canonical metadata. The user pulled it
before D1; this task does not manually bump it.

The operational agenda is docs/DESKTOP_PLAN.md. Finish Windows/Ubuntu CI evidence
before accepting D1 across both platforms. Then D2 adds versioned local projects
and draft management; D3 adds explicit MQTT connections. Preserve input and
separate systems throughout. Existing Symcon practice tests do not establish
desktop acceptance. The user commits/pushes through GitHub Desktop only.
