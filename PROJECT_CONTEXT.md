# Project context: Z2M-Automations

As of 2026-11-08. Repository Burki24/Z2M-Automations; working branch dev,
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
Desktop CI run 42472007945 passed on Windows and Ubuntu 24.04 for source
f878516f2c677d5f45780523313bc599068ab82f: all 13 tests, package builds, real
renderer smoke, six layout/theme combinations, non-empty capture and designer
archive/artifact upload. D1 is complete for its offline foundation/CI scope.
Bounded download retries, a shared verified cache and Linux-CI-only software
rendering resolved the previously observed CI failures in this run.
Native Ubuntu acceptance, 26.04 and installed-app tests remain open. See docs/D1.md.
No Live system was contacted or changed.

## Versioning and next work

The automatic metadata action on Symcon_ModuleCI/main is operational. Run
42367039704 passed; bot commit 744fc251503047068bed507a6f84cd4457cf6cb8 set
version.json to 0.2.0. The subsequent D1 source push produced metadata commit
1d4f284274bc1f67dd7e24c788026f1eec6438b1 with version 0.3.0. Current metadata
commit f2c369ce7952d6feb5b53f4a5a49058061e6dfdd sets version 0.8.0.
Builds read that canonical metadata; do not manually bump it.

The operational agenda is docs/DESKTOP_PLAN.md. D1 platform CI evidence is
recorded in docs/D1.md. Next, D2 adds versioned local projects
and draft management; D3 adds explicit MQTT connections. Preserve input and
separate systems throughout. Existing Symcon practice tests do not establish
desktop acceptance. The user commits/pushes through GitHub Desktop only.
