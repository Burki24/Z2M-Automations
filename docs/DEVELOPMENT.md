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

Ubuntu CI uses `scripts/ubuntu-apt.mjs` for build tools and the built DEB's
dependencies. A complete `dpkg-query` installed-state check skips network access
when all four build packages are present; a built DEB is never skipped this way.
Updates use `--error-on=any`: failed indexes cannot silently reuse old metadata.
Only transient acquisition failures are retried, at most twice per mirror and
phase with a one-second delay. Calls have up to three minutes for cold indexes
within a shared six-minute acquisition budget plus bounded process shutdown.
The remaining budget is divided between the selected mirrors, so a stalled first
mirror cannot consume the fallback's time. Signature, hash, TLS verification,
dependency and process failures remain terminal.

Before necessary acquisition, read-only probes run in the same sudo environment
as APT. They report Azure's IPv4 DNS result and probe the noble, noble-updates and
noble-security HTTPS InRelease files on the official Ubuntu servers and the
independently hosted [kernel.org](https://mirrors.kernel.org/) and
[OSU Open Source Lab](https://ftp.osuosl.org/pub/ubuntu/) mirrors. Each curl probe
has a three-second connection limit and eight-second total limit; logs distinguish
DNS lookup, TCP connection and TLS handshake timings. Only complete, reachable
repositories qualify, with at most two selected. IPv4 is selected only after the
IPv4 HTTPS probes succeed. If none qualifies, acquisition fails before APT starts.
HTTPS probes do not replace APT's signature/hash verification.

All candidates use isolated Ubuntu 24.04 x64 deb822 sources and the installed
Ubuntu archive signing key, limited to main/universe in noble, updates and
security. No trust key is added for a mirror. Unreachable runner sources and
unrelated third-party repositories are excluded without rewriting system files.
Translation and DEP-11 indexes are unnecessary and disabled. A repository ID is
remembered through `GITHUB_ENV` only after APT verifies its signed metadata; the
next step re-probes that selection.

Sources, package lists and downloads use a random directory directly under
`/tmp`, outside potentially private runner-home ancestors. Only the two partial
download directories are owned by `_apt`. Before APT starts, actual `_apt` checks
verify directory traversal, partial-directory writes and source/keyring reads.
`dpkg-deb` reads the built package's identity without sudo. The DEB is copied
into the isolated `archives` directory as `Package_Version_Architecture.deb`,
with mode 0644, checked against the original with SHA-256 and read-checked as
`_apt`; the original artifact remains unchanged. Identity fields are bounded,
with the application's canonical x.y.z version and amd64/all architecture.
APT can read a local DEB in place during `--download-only` without populating
its archive cache. Explicit staging makes the local archive available to the
subsequent `--no-download` operation. A successful acquisition must not be
assumed to cause a later call to fail. Archive lookup is implemented in
[APT's archive handling](https://github.com/Debian/apt/blob/main/apt-pkg/acquire-item.cc).
No runner-home permissions are broadened. An unexpected root-download fallback
is treated as a permission failure, including when APT exits with status zero.
Packages are downloaded before one `--no-download` installation,
limited to two minutes. Install/configuration failures are never replayed. The
existing installed-app smoke, removal checks and success-only artifact upload
remain mandatory. Bounded diagnostics include phase, mirror, attempts, byte counts,
error categories (including missing archives, dependencies and dpkg failures),
an explicit unsandboxed-download warning flag, access-check
scopes and the last eight APT index events. Hosts/suites/index types
are allowlisted; private URLs, paths, process output and credentials are not
echoed. Synthetic tests and real subprocess output checks cover readiness,
routing, retry/fallback, identical package staging and failure paths. A native
Linux CI regression test proves that `_apt` cannot read through a private ancestor
and can access the new sources, caches and staged package without changing it.
A second native test builds a tiny dependency-free DEB and exercises real APT
acquisition with empty sources and an isolated empty package database. It follows
the production order: stage the archive, acquire dependencies, then check
`--no-download`. Both APT calls must succeed without acquiring an archive; the
package bytes and database must remain unchanged. All calls are download-only:
no package is unpacked or configured and no network repository is accessed.

CI run 43069225091 confirmed the sandbox checks, HTTPS routing, signed metadata,
dependency downloads and source/package smoke tests. Its final installation
exited with code 100; the original APT error text was not retained.
Run 43072699700 stopped earlier because the added native test incorrectly
expected exit 100 after a successful acquisition; APT actually returned zero.
That assertion is removed in favor of checking the staged archive's successful
use. A new Ubuntu CI run must confirm installed-app smoke, removal and DEB
upload; Windows checks and the non-installing APT regression do not establish
that result.

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

After `npm run build`, `npm run test:system-link-ui` runs a separate hidden
Electron fixture with synthetic data. It inspects DOM and layout only and never
captures images. It covers the desktop system-link assistant's three stages,
eight sorted system choices, DE/EN preservation, failed checks, offline/shared
brokers, configuration selection, corrective navigation and reopening. Keyboard,
Escape and page-local wheel input verify the dialog's internal scroll boundary.
The wheel check waits for the observed scroll result. Layout
checks use both themes at 360 and 1280 pixels. Linux needs Xvfb and Electron's
sandbox setup as shown in the CI workflow. This test does not replace the
full source/package smoke or native Ubuntu acceptance. The ordinary unit suite
also verifies mesh-only suggestions, template safety, schema limits and actual
correlated reads against isolated loopback MQTT peers.

`npm run test:extension-update-ui` is another DOM-only check, included in both
platform jobs. It covers pending update/transfer progress, automatic draft-check
modes, the single check action, explicit-transfer controls and DE/EN feedback.
Confirmation layout is checked in both themes. It captures no images. Backend
integration tests use the real pinned extension to verify consent, backup and
stop ordering, switch-only/unchanged drafts and lost replies without replay.

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
