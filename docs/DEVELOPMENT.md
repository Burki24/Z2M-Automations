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

setup:tools explicitly invokes only the reviewed pinned Electron download. Do not
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
Draft smoke labels every wait and saves bounded state diagnostics plus a
screenshot as apps/desktop/out/smoke-failure.* on failure. CI uploads these
separately when a job fails. The shared-broker fixture delays the second system's
catalog response to exercise independent read timing. Draft editing waits for
all assigned system reads and a matching rendered context.
The cross-system form check selects foreign condition/action devices, verifies
alphabetical ordering and stable ownership, and reopens the saved draft across
a language change. Transfer tests use two isolated brokers and reject old
extension versions and revoked receiver grants before validation.

D2 adds real temporary project save/reopen/backup/restore, draft lifecycle,
main-only credential file import, OS-protected storage when available and keyboard/
wheel checks to smoke. Test dialogs choose only synthetic files in the temporary
profile; production uses native dialogs. `tests/projects.test.mjs` also exercises
an actual exclusive Windows file lock. Its helper prefers installed PowerShell 7
and falls back to Windows PowerShell. An event-driven handshake allows up to
30 seconds for startup and requires an explicit lock-ready signal before the
save assertion. Cleanup waits for release and process exit before removing test
files; a failed assertion also releases the helper. The test then confirms that
saving succeeds after unlocking.

`LOCK_HELPER_DIAGNOSTICS` reports the shell name, PID, phase, elapsed time,
exit code/signal, output byte counts and allowlisted exception type/HRESULT.
Raw stdout/stderr, file paths and command contents are never included. Phases
distinguish process startup, lock acquisition and release. Portable lifecycle
tests cover delayed/fragmented readiness, spawn errors, early exit, bounded
startup/shutdown failures and cleanup after a failed assertion. They do not
replace the native Windows lock test, which remains mandatory in Windows CI.

Run the same checks on Ubuntu; simulated
missing/locked keyrings do not establish native secret-service acceptance.
See [D2](D2.md) for the format, persistence and credential boundaries.

~~~sh
npm run package
npm run make
npm run smoke:packaged
npm run pack:designer
~~~

package stages an executable application; make builds the native Windows setup
or Ubuntu .deb. Both read version.json, including the copied application package
version. Do not hand-bump tracked package versions or version.json. Signing,
installed-app acceptance and publication belong to D7. Never publish from these
local commands. Forge dependencies are development tooling, not renderer APIs.

The Windows maker is now NSIS with a German/English directory-selection wizard;
see [Windows installer](WINDOWS_INSTALLER.md). It wraps Forge's prepackaged
application and reads canonical version metadata. Its build-only downloads use
`ELECTRON_BUILDER_CACHE` when set; local builds may point that and process-local
TEMP/TMP to an ignored directory on a drive with sufficient space. Production
dependencies and the Ubuntu maker are unchanged.

D3 tests use an independent ephemeral loopback MQTT peer, never a real broker.
Install OpenSSL on development/CI hosts for temporary CA and mutual-TLS test
certificates (Git for Windows supplies a supported local executable). MQTT.js
5.16.1 is a pinned main-process production dependency; mqtt-packet 9.0.2 is
test tooling. Packaging stages the lockfile-selected production dependency
closure with original licenses. `smoke:packaged` verifies that closure inside
ASAR, then repeats the actual read-only UI/MQTT smoke against the packaged
executable. It must follow `package` or `make`. See [D3](D3.md).

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
D1/D2/D3/D4 checks. D2 exercises temporary persistence and credentials; D3 adds
synthetic MQTT/TLS protocol and recovery checks. D2 CI run 42481799451 passed
Windows and Ubuntu 24.04. D3 CI run 42491457811 also passed both platforms;
D4 requires a new platform run after the user pushes.
D4 adds local editor/permission/schema/sequence/exchange tests and actual
Electron input recovery after renderer reload. Build verifies the pinned schema
artifact before staging it. AJV 8.20.0 and YAML 2.9.1 are main-only production
dependencies; no validation/translation runtime enters the shared browser UI.
See docs/D1.md through docs/D4.md for current scope.
