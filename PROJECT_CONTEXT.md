# Project context: Z2M-Automations

As of 2026-11-08. Repository Burki24/Z2M-Automations; working branch dev,
primary branch main. Product editions: Z2M-Automations for Windows / for Linux.

## Current state

D0 localization is implemented. D1 now provides a shared TypeScript/Electron/
Forge foundation: offline renderer, two synthetic systems, strict preload IPC,
local assets, DE/EN switching and bounded opt-in diagnostics. D2 now implements
portable local projects, per-system drafts, backup/restore, conflict detection,
native file-dialog integration and a separate OS-protected/session credential
vault. D3 adds explicit main-process MQTT/TLS connections, correlated read-only
status/editor requests, device/scene catalogs and separately stored snapshots.
D4 now connects the shared rule/sequence editor to local project drafts, adds
main-process schema/capability checks, directed draft permissions and private
YAML/JSON import/export with mandatory replacement backups.
D5 adds explicit extension installation, validation and disabled-rule storage
with private backups and independent status confirmation. See docs/D5.md.
D6 adds confirmed activation, stop, single runs and restart recovery for
stored rules, with correlated execution observations. See docs/D6.md.
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

D2 CI run 42481799451 passed Windows and Ubuntu 24.04 for source
29005ae875a502b834423eaeb7dc7fee21a724a0, including package builds and smoke.
D3 CI run 42491457811 passed Windows and Ubuntu 24.04 for source 1ebaead.
The NSIS directory-selection change passed both platforms in run 42494004402.
The owner reports the updated Windows setup works; installed Ubuntu remains
unverified. D4 passed Windows and Ubuntu CI in run 42553084613. D5 passed both jobs in run 42557311324.
Native Linux keyring/dialog evidence remains open. See docs/D2.md and docs/D3.md.

## Versioning and next work

The automatic metadata action on Symcon_ModuleCI/main is operational. Run
42367039704 passed; bot commit 744fc251503047068bed507a6f84cd4457cf6cb8 set
version.json to 0.2.0. The subsequent D1 source push produced metadata commit
1d4f284274bc1f67dd7e24c788026f1eec6438b1 with version 0.3.0. Current metadata
commit fb1d07c sets version 0.14.0 after D4.
Builds read that canonical metadata; do not manually bump it.

The operational agenda is docs/DESKTOP_PLAN.md. D1 platform CI evidence is
recorded in docs/D1.md. D2 implementation and CI are complete; D3 read-only
MQTT passed its Windows/Ubuntu CI run. D4 local editing passed both platform jobs. D5 transfer
passed both platform jobs. D6 operation passed both jobs in run 42561493087.
D7 adds the beta user guide and installed-package checks. See docs/D7.md for
the outstanding native desktop acceptance. Preserve input and
separate systems throughout. Existing Symcon practice tests do not establish
desktop acceptance. The user commits/pushes through GitHub Desktop only.
