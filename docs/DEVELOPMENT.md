# Development

Use Node 24.20.0 and npm 11 on Windows 11 x64 or Ubuntu Desktop LTS x64.
All repository documentation and commit messages are English. Localized UI text
belongs in the local DE/EN JSON catalogs. The user alone commits and pushes.

## Setup and checks

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run setup:tools
npm run verify
npm run smoke
npm start
~~~

setup:tools explicitly invokes only the reviewed pinned Electron download and,
on Windows, electron-winstaller's selection of its shipped 7-Zip binary. Do not
enable all dependency lifecycle scripts to work around missing tools.
Transient Electron download errors are retried at most three times, with
one- and three-second delays and a three-minute limit per attempt. Integrity,
permanent HTTP and local installer-helper errors still fail immediately.
CI shares `electron_config_cache` between setup and Forge and caches only the
download artifacts. Forge uses Electron's pinned checksum manifest too.

verify builds the canonical designer and TypeScript backend, checks UTF-8/LF,
matching catalog keys/parameters, markup/key references, generated asset hashes,
strict types and behavior tests. smoke opens its own Electron window with
a temporary profile, uses only synthetic data and exits. The window is hidden
on Windows; on Linux it is mapped onto the CI Xvfb display for image capture
(a local Linux run briefly shows a window). It checks the real
preload/renderer, system switching, language/input preservation, diagnostics and
light/dark layouts. Its local screenshot is apps/desktop/out/smoke.png.

D2 adds real temporary project save/reopen/backup/restore, draft lifecycle,
main-only credential file import, OS-protected storage when available and keyboard/
wheel checks to smoke. Test dialogs choose only synthetic files in the temporary
profile; production uses native dialogs. `tests/projects.test.mjs` also exercises
an actual exclusive Windows file lock. Run the same checks on Ubuntu; simulated
missing/locked keyrings do not establish native secret-service acceptance.
See [D2](D2.md) for the format, persistence and credential boundaries.

~~~sh
npm run package
npm run make
npm run pack:designer
~~~

package stages an executable application; make builds the native Windows setup
or Ubuntu .deb. Both read version.json, including the copied application package
version. Do not hand-bump tracked package versions or version.json. Signing,
installed-app acceptance and publication belong to D7. Never publish from these
local commands. Forge dependencies are development tooling, not renderer APIs.

## Shared source ownership

Edit packages/designer/src, build the versioned archive and review its manifest.
Symcon imports that explicit archive and verifies its committed assets without
needing this clone. See packages/designer/README.md. Native tile/helper sources
remain in Symcon; the Z2M runtime/schema remain canonical there too. Imported
shared sources retain their existing four-space formatting; new desktop/tooling
sources use two spaces. Preserve third-party sources unchanged.

## Platform verification

The desktop CI matrix uses Windows and Ubuntu 24.04 from the same commit.
Ubuntu packaging needs fakeroot and dpkg; renderer smoke uses Xvfb with Chromium's
sandbox enabled. Local Windows success is not Ubuntu acceptance. Actual Ubuntu
24.04/26.04 desktop installation, Wayland/X11, DPI, dialogs, credentials, update
and uninstallation remain separate milestone evidence. No local Ubuntu or WSL
installation was available during D1. Explicit Linux CI smoke uses software
rendering before Electron startup, while normal launches and Windows keep their
existing renderer settings. Screenshot capture remains mandatory. CI run
42472007945 passed both platforms, including capture; see docs/D1.md for the
completed D1 scope and remaining native installed-app verification limits.

No real broker, Symcon system, private project or device command is part of the
D1/D2 checks. D2 exercises temporary persistence and credentials; later features
must add synthetic protocol and recovery checks at their actual boundaries.
See docs/D1.md and docs/D2.md for current scope.
