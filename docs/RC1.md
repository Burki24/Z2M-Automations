# RC1 preparation

**English | [Deutsch](RC1_DE.md)**

Scope: Z2M-Automations for Windows (Windows 11 x64) and Z2M-Automations for
Linux (Ubuntu Desktop 24.04 LTS x64). Ubuntu 26.04 acceptance is separate.
RC1 is an acceptance stage, not a second application-version authority.

## Offline help and focused verification on 2026-11-17

The app now ships both complete 20-chapter handbooks and 32 localized images.
Help/F1 opens the relevant chapter without Internet access, with search, language
switching and image enlargement. Hover/focus tooltips explain key controls;
operation-stop warnings remain in the page and confirmations. The illustrated
reference is 0.125.0; local verification installers use the existing 0.127.0
metadata. These dirty-tree builds are verification material, not the final RC.

| Check | Windows 11 x64 | Ubuntu 24.04.5 x64, Hyper-V |
| --- | --- | --- |
| Mandatory local verification | 255 tests: 253 pass, two Ubuntu-only skips; complete capture-free UI passes | 255 tests: 252 pass, Windows-only and two disposable-CI-only APT skips; complete capture-free UI passes |
| Native package | EXE built; packaged runtime/dependency and help checks pass | DEB built; packaged runtime/dependency and help checks pass under Xvfb/X11 and native GNOME/Wayland |
| Offline delivery | All 36 handbook assets verified inside ASAR | Same 36 assets verified; extracted DEB ASAR equals the tested package |
| Native desktop session | Source and packaged app workflows pass | Complete automated packaged-app run passes in the unlocked GNOME/Wayland session, including Help/F1, keyboard focus, protected test credentials and save on close |

The final Ubuntu desktop run used `Z2MA_SMOKE_TIMEOUT_MS=90000 node
scripts/smoke-packaged.mjs --no-capture` directly in the active Wayland session,
without Xvfb or a sandbox bypass. It exited with status zero and all required
workflow markers; the session remained unlocked throughout. Source hashes match
the reviewed local files. The previously installed app was left in place; this
run verifies the built package, not its system-wide upgrade/removal lifecycle.

All app and network checks use synthetic projects and isolated MQTT peers.
No real Z2M installation, rule or device was controlled. The previous D7 and
0.99.0 acceptance remains valid. The subsequent clean matrix is recorded below.
Ubuntu 26.04 acceptance and installer upgrade/rollback/removal checks
remain separate from this automated desktop run.
Signing, publication and Stable promotion remain separate decisions.

Follow-up for CI run 44068759284: the 360px German heading overflow was reproduced
before correction on both platforms using wide desktop fonts. Text wrapping now
passes 24 language/theme/font/width combinations at 360/600/1120px. Fresh source
and packaged checks pass on Windows, and on Ubuntu with `CI=true`, Xvfb and
software rendering; all 36 packaged handbook assets are verified. Both complete
`verify:local` runs pass with the counts above and the capture-free extension UI.
The final runs were serialized after an initial Windows extension-UI workspace
load timeout while the VM was testing. The smoke deadline remains 30 seconds.
The tooltip check explicitly changes focus instead of refocusing an already
active button. This initial follow-up rebuilt application packages with
`npm run package`; the subsequent hosted run below supplies installer evidence.

## Clean CI confirmation on 2026-11-17

[Run 44077203946](https://github.com/Burki24/Z2M-Automations/actions/runs/44077203946)
passed Windows and Ubuntu on the first attempt. Both jobs built version 0.129.0
from metadata commit `9e17622a7c816b6d43d9c258ca8fc960827311c3`, following source
commit `ca644ddbcfa8d929376a6f4c015a9696b9070f07`. Both dependency audits report
zero findings. Source, packaged and freshly installed app checks passed,
including 360/600/1120px offline help in DE/EN, light/dark and system/wide fonts.
All 36 handbook assets were verified in each package. EXE and DEB uploads and
both candidate manifests were downloaded and checked: the manifests identify
the same version/commit and their sizes and SHA-256 values match the artifacts.
These fresh-install/removal checks do not establish upgrades with retained user
data or replace native desktop acceptance.

## Tooltip follow-up on 2026-11-17

The owner reported inconsistent hint visibility and font sizes in 0.129.0.
Native title hints and contextual help now use one desktop tooltip, including
new controls and dialogs. Hover resumes after clicking within the same control;
localized title updates preserve the latest value and existing accessibility
descriptions. Long hints stay within the viewport margin.

Fresh `verify:local` passes on Windows (253 pass, two platform skips) and Ubuntu
24.04.5 (252 pass, three platform/disposable-CI skips), with 255 tests and the
complete capture-free extension-update UI on each. Fresh source and packaged
app runs pass on both platforms; Ubuntu uses `CI=true`, Xvfb/X11, software
rendering and Chromium's sandbox. Both packages verify all 36 handbook assets.
`DESKTOP_TOOLTIPS_OK` is required by source, packaged and installed smoke gates.
It checks real mouse/key events, click/hover recovery, disabled controls, dynamic
title batches, dismissal, dialog fonts and DE/EN localization without images.

An initial Windows packaged run exceeded the unchanged 30-second deadline after
passing the new tooltip/help assertions. The shared pointer/timing cases now run
once, with additional localized keyboard/title/dialog assertions in German.
The final complete Windows packaged run passes in 25.3 seconds; source and Ubuntu
package runs also pass the normal deadline. No production delay or smoke timeout
was increased. These local builds retain 0.129.0 metadata and do not update the
installed app. The tooltip change needs a fresh hosted matrix after the owner's
commit/push; actual installer upgrades and current native desktop acceptance
remain separate.

## Candidate identity and build gates

The final candidate requires the owner's source commit and push. The existing
metadata prerequisite then selects one immutable commit and version for both
platform jobs. Do not hand-edit `version.json` or distribute a local verification
build under the old metadata as the final RC.

The matrix audits all dependencies before packaging. The existing source,
capture-free UI, packaged-app and installed-package checks still apply. After
these pass and the designer archive is built, `npm run prepare:rc` produces
`candidate-Windows.json` or `candidate-Linux.json` in each uploaded artifact.
Each manifest records the checked commit, version, build/date, platform,
installer size/SHA-256 and designer archive/content hashes. The preparer rejects
dirty or untracked source, mismatched identity and missing, empty or duplicate
installers. Ignored build output is permitted. A manifest records build identity;
it does not replace native acceptance or sign a package.

Keep both platform manifests with the EXE, DEB and rollback packages. Accept RC1
only when both manifests identify the same commit and version and the installer
hashes match. Packages remain unsigned and unpublished. Stable promotion, tags,
signing, merging and publication require a separate instruction.

## Packaging dependency remediation

The baseline audit reported eight moderate package findings from two advisories:
[glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and
[minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).
These packages are build tools; the production-only audit reported no findings.

- Update compatible upstream ASAR to 4.3.2, which brings glob 14.0.6 and the
  corrected modern matcher into the locked dependency closure.
- The current NSIS builder still requires affected minimatch 9/10 versions.
  The root override targets only minimatch `>=7.0.0 <11.0.1`, selecting 11.0.8.
  The named matcher and `Minimatch` class used by these consumers are tested.
  Legacy callable minimatch 3/5 consumers remain untouched.
- Keep Forge, the NSIS maker and application runtime dependencies pinned.
  Do not apply the audit tool's suggested NSIS downgrade. Remove the override
  when the affected upstream consumers adopt corrected versions, then repeat
  clean installation, audit and actual packaging on both platforms.

CI run [44150360859](https://github.com/Burki24/Z2M-Automations/actions/runs/44150360859)
stopped at the dependency audit on both platforms. The high-severity
[picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) accounts
for 17 findings through the build dependency tree. No fixed release was
available. For Electron Rebuild 4.2.1, pin its node-gyp to 11.1.0, before it
adopted tinyglobby and picomatch. Both node-gyp and its header cache (cacache
19.0.1) use the existing audited glob 14.0.6. The packaging test checks Electron
Rebuild's node-gyp entry point, solution discovery and cache verification.
Remove these overrides when Electron Rebuild resolves an audited dependency tree.

## Local verification on 2026-11-16

- A clean pinned installation, reviewed tool setup and both full and
  production-only audits pass; all vulnerability counts are zero.
- Windows `npm run verify:local` passes build, types, text/designer integrity,
  239 tests and the complete capture-free extension-update UI test. Two
  Ubuntu-specific APT tests are skipped on Windows.
- Capture-free source smoke, system-link UI and packaged smoke pass. The actual
  NSIS setup build succeeds; its product version and packaged application both
  read the existing `0.119.0` metadata. The designer archive also builds.
- This uncommitted local build verifies the changed toolchain, not final RC
  identity. Fresh Windows/Ubuntu CI, installed-package checks and the focused
  native acceptance above remain gates after the owner's source commit/push.
  No local Ubuntu shell was available for a new Linux build. No live Z2M access,
  device commands or image capture were part of this verification.

## Focused native acceptance after the new matrix

Preserve the completed D7 and 0.99.0 workflow acceptance; test the later changes:

1. Update the installed app and reopen a retained `.z2ma` project. Save/reopen
   `.z2map`, and import/export selected `.z2mad` rules with needed sequences.
2. Reconnect with unsent local work and newer Z2M changes. Check independent
   merges, explicit conflict choices, cancellation and recovery backups.
3. Check device-network selection and typed window-handle/sensor channels.
   Missing partner data must block before stop, preserving existing operation.
4. Transfer a reviewed change with and without the explicit resume choice.
   Confirm stored revision, previous restart preference and disabled new rules.
5. Verify native dialogs, wheel/keyboard boundaries, restart/reconnect and protected
   credentials on Windows and the signed-in Ubuntu desktop session. Check update,
   rollback and removal without losing retained projects.

Use synthetic projects and isolated peers. Live access and actual device commands
need their own practical-test authorization. Record OS/package versions and
results separately for each platform. Do not equate headless CI with desktop
acceptance. Resolve blocking findings before Stable; add no unrelated features
during this candidate round.
