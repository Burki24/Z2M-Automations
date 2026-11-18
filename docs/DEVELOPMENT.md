# Development

**English | [Deutsch](DEVELOPMENT_DE.md)**

Offline help is built from the committed DE/EN handbooks by `scripts/build-help.mjs`.
Its deliberately limited Markdown converter escapes HTML and rejects foreign
links. Both HTML files, 32 matching screenshots, local styles/scripts and an asset
hash manifest are staged under `.build/renderer/help`, inside the packaged ASAR
on both platforms. No runtime download or Markdown dependency is added.
`tests/help.test.mjs` verifies chapters, exact image bytes, HTML safety and the
fixed help IPC. The normal source, packaged and installed smoke gates now require
`DESKTOP_HELP_OK`: actual Help/F1, language/search, all image loads, image
enlargement, viewer isolation, tooltips, preserved input and a 360px layout.
Run these as `node scripts/smoke.mjs --no-capture` and
`node scripts/smoke-packaged.mjs --no-capture` after the mandatory `verify:local`
and native packaging. The packaged gate checks every help asset hash; UI checks
create no images. Native desktop/keyring acceptance remains separate.

Desktop title hints and mapped explanations now share one tooltip and font.
Dynamic title updates and language bindings are adopted without retaining a
second native popup; existing accessibility descriptions are preserved. Hover
can resume inside a clicked control, pending hints cancel on leave, and Escape
prevents pointer motion inside that control from reopening a dismissed hint.
Source, packaged and installed smoke also require `DESKTOP_TOOLTIPS_OK`: real
renderer mouse/key events, disabled controls, nested spans, title updates,
hoverable popups and uniform dialog fonts in DE/EN. The checks create no images.

Run 44068759284 exposed overflow in the German handbook at 360px. The long
heading is reproducibly wider than its text area with DejaVu Sans on Linux or
Verdana on Windows. Handbook text now wraps long words without clipping them.
The help smoke waits for the actual viewport and checks page and text-block
widths at 360/600/1120px, in both languages/themes and with system/wide fonts.
Hidden Windows test windows disable background throttling to match a visible
help window; the 30-second CI deadline is unchanged. These checks run through
the normal source, packaged and installed gates without image capture.

Native VM tests exposed 600ms fixture RPC limits during real extension disk I/O.
The runtime-control fixture now uses a bounded 2000ms budget; production remains
at 10000ms and all stop/replay assertions are unchanged. The full smoke runner
retains its 30000ms CI default; a constrained local VM may explicitly set
`Z2MA_SMOKE_TIMEOUT_MS=90000` (validated range 30000–120000). On deadline it
terminates gracefully, then forcibly after five seconds if necessary. A real
child-process regression checks reaping even when SIGTERM is ignored.
For Xvfb, unset `WAYLAND_DISPLAY` and set `XDG_SESSION_TYPE=x11` so Electron does
not select a locked native Wayland session. A direct GNOME desktop check requires
an unlocked session; virtual-display success is not substituted for that check.

RC preparation adds `npm run audit:dependencies` (runtime and development
dependencies, moderate-or-higher findings fail) and a candidate identity/checksum
step after platform acceptance in CI. Run the audit after a clean
`npm ci --ignore-scripts --no-audit --no-fund`, then `npm run setup:tools`, the
mandatory `npm run verify:local` and capture-free smoke/packaged smoke. Actual
`npm run make` exercises the changed ASAR and NSIS dependency paths. Never use
`npm audit fix --force` for this toolchain; see [RC1](RC1.md) for the reviewed
override, immutable build handoff and remaining platform acceptance.

`npm run prepare:rc` requires `Z2MA_BUILD_SHA`, a clean source checkout, one
versioned native installer and the matching designer archive. When CI supplies
`Z2MA_BUILD_VERSION`, it must match the checked metadata. Its `candidate-*.json` output is
included in the existing platform artifacts. Local dirty-tree packaging may
verify the toolchain but does not establish the final candidate identity.

The 2026-11-16 RC preparation passes a clean install, full/production audits
(zero findings), Windows `verify:local` (239 passing tests, two Ubuntu-specific
skips, complete capture-free UI), capture-free source/system-link/packaged smoke,
NSIS setup creation and designer packing. Fresh Ubuntu/installed-package CI
and focused native RC acceptance remain separate; see [RC1 evidence](RC1.md).

Partner-device preflight (2026-11-16) checks required catalogs before any stop.
Desktop MQTT integration tests cover actions, conditions and sequences on two
independent synthetic brokers, including data lost after confirmation. They
assert no stop, store or activation and unchanged execution, grants and drafts.
The shared browser/tile workflow validates before stopping, then revalidates
after a required stop; the native store guard remains authoritative. Missing
catalogs on unrelated networks do not block a local-only transfer.

The Windows `npm run verify:local` recheck passes 233 tests (two Ubuntu-only APT
skips), types, build, integrity and the complete capture-free UI fixture (15.5 s).
Its first run completed all DOM assertions but exceeded the unchanged 30-second
process deadline during exit. The isolated full recheck exited successfully.
The subsequent `node scripts/smoke.mjs --no-capture` also passes. The Symcon
consumer's full PHP/282-JavaScript suite and capture-free DE/EN browser/tile
acceptance pass with shared content `3deb84bb5545`. Ubuntu CI and installed-system
acceptance remain separate.

Module-view recovery verification on 2026-11-15 passed `npm run verify:local`
(230 passing tests, two Ubuntu-only APT skips and the complete capture-free
extension-update UI test in 15.3 seconds) and `node scripts/smoke.mjs --no-capture`.
The pinned Symcon package is `0.117.0`, content `1dc396096d94`. Its full PHP suite
and 279 JavaScript tests, capture-free browser/tile acceptance, structure, encoding,
official JSON style (20 files) and PHP CS Fixer (164 files) pass. Focused tests
cover repeated transient failures, exhausted retry/time budgets, overdue waits,
cancellation and permanent errors. Live and new platform CI evidence are separate.

Connected-workspace regressions cover first reads with unsent local rules, actual
base persistence, independent edits/deletions, explicit conflict choices, open
forms, interrupted evidence and guarded undo. Portable-file checks cover format-1
projects, format-2 `.z2map`, `.z2mad` selections and dependency closure, disabled
new rules and unchanged destination grants. The capture-free fixtures exercise
the shared controls in Electron, browser and tile. See ADR 0006. No live system
or runtime action is part of these checks.

Final local evidence on 2026-11-15: `npm run verify:local` passed build, strict
types, integrity and 230 tests; two native APT tests require Ubuntu. Its complete
capture-free extension-update UI test passed in 15.2 seconds. The subsequent
`node scripts/smoke.mjs --no-capture` passed actual Electron/MQTT reconciliation,
editing, file persistence, reopen, save on close and 360/1024/1920/3840px layouts
in both themes. The pinned Symcon package is `0.116.0`, content `0fde49a6e850`;
its full PHP/278-JavaScript suite, capture-free browser/tile tests, structure,
encoding, official JSON style (20 files) and PHP CS Fixer (164 files) pass.
Platform CI and installed/live acceptance remain separate.

Use Node 24.20.0 and npm 11 on Windows 11 x64 or Ubuntu Desktop LTS x64.
English repository documentation is authoritative, with complete German `_DE.md`
companions and reciprocal language links. Update both versions together. Code
comments, technical identifiers and commit messages stay English. Localized UI
text belongs in the local DE/EN JSON catalogs. The user alone commits and pushes.

`npm run check:docs` is part of `npm run check` and therefore of `verify:local`
and both desktop CI jobs. It checks complete language pairs, prominent reciprocal
links, translated heading structure, case-sensitive local paths/anchors and the
manuals' language-specific screenshot mapping and manifest dimensions/sizes.
Its isolated regression fixtures reject missing translations, broken navigation,
omitted sections, wrong file case, missing anchors, mixed-language images and
stale image metadata without capturing any images. It does not assess translation
meaning or image rendering quality. See the [documentation index](README.md).

The shared guided shell and Symcon presentation adapter are canonical under
`packages/designer/src`; the desktop workspace entry point re-exports the shell.
After changing them, verify the desktop and import `npm run pack:designer` output
into Symcon with its checked importer. Run Symcon's PHP/Node suite and the
capture-free `tests/designer-localization.browser.mjs` using an existing Playwright
installation. That fixture covers actual list/editor wheel input, field correction,
local rule switches, cancellation and explicit scoped stop/check/store in both
browser and tile. It contacts only its own loopback fixture. Keep native installed
acceptance and platform CI evidence separate from these local checks.

The Symcon guided transfer distinguishes the saved restart preference from the
receiver's durable restart state. A confirmed `resumeStatus: stopped` disarms
restart even when `resumeAfterRestart` remains enabled. Keep that preference;
do not block storage or repeatedly stop an already stopped receiver. Missing or
still armed restart confirmation must continue to block storage. Regression
checks cover the new rule alongside the complete existing draft in browser/tile.

Step 8 offers an unchecked, per-transfer choice to resume previous automatic
operation in all three surfaces. Only a previously confirmed active receiver can
resume, after revalidation, confirmed storage, fresh readback and a new activation
challenge. Preserve the saved restart preference; never release a new disabled
rule or replay an interrupted single run. Without the choice, operation stays
stopped. Desktop content transfers preserve checked flags only with this explicit
choice; otherwise their existing all-disabled policy remains. Regression checks
cover both recovery preferences, stopped systems, cancellation, changed input,
failed checks/readback, lost replies and read-only reconciliation. Hidden Electron
and headless browser/tile tests verify the real DE/EN checkbox, safe initial focus,
per-transfer reset and bounded dialog layout without capture.

Module view reads recover from explicit transient HTTP availability errors or a
stale workspace/system snapshot with at most five retries, delayed by
250/500/1000/2000/2000 ms. No new retry starts outside the ten-second recovery
window; individual reads retain their existing request timeouts. Recovery restarts
the complete GET read and all catalog pages; partially read old pages are discarded.
The view stays busy with localized neutral progress. A previous red read warning
is hidden during recovery and returns only if the bounded read ultimately fails.
Authorization failures, foreign bindings and malformed data remain errors.
Persistent failures retain the previous displayed model and its read warning.
Recovery never repeats transfer, runtime, installation or editor mutations.
Structured console events contain only read stage, fixed reason, HTTP status
and attempt. The browser/tile regression injects three temporary read failures
after successful storage and verifies waiting and recovery with exactly one store
request. It also checks permanent failure and a later explicit view refresh.

Device flow cards and inspector fields identify the owning Z2M network by system
name and base topic. Local ownership follows the selected stable system ID;
remote references use their declared base topic, including for missing devices.
The capture-free browser/tile fixture checks both languages, system switches and
identical device IDs across networks. Unknown or ambiguous topics retain their
literal identity instead of borrowing another system's display name.

The shared editor enables network choices from the adapter's `deviceSystems`
metadata in both products. Device triggers remain local. Symcon preserves directed
action grants; remote conditions additionally require the reply-direction grant.
Its optional `conditionReason` distinguishes that restriction from action access.
Missing partner catalogs remain selectable with guidance, without borrowing local
devices or starting an implicit catalog read.

Symcon's missing/unconfirmed catalogue guidance appears above the work area,
with its primary navigation action directly below the warning text. Its bounded
message area leaves the action reachable in narrow tiles. Opening step 4 or
refreshing the module view must not start a device read. On step 4 the catalogue
card highlights the explicit refresh action; the redundant navigation warning
is omitted. Other form warnings and failed view reads remain visible. The offline
browser/tile fixture checks navigation, refresh, language changes and recovery
separately and verifies that drafts survive them in DE/EN.

Both desktop editions already keep the Symcon warning out of their workspace.
Their connection page highlights Connect or Read inventory when a current read
is missing. The capture-free desktop smoke also checks that step 4 has no link
back to itself and no duplicate Symcon warning.

## Setup and checks

Catalog regressions fill the legacy choice budget before a synthetic window
handle and sensor. Typed channels and numeric units must survive without expanding
the legacy lists or changing read/write rights. Extension catalog construction
has a separate 512 KiB byte budget and rejects an oversized complete result.
The desktop parser accepts typed units when legacy numeric lists are exhausted
and reports `catalog_limit` without accepting a partial inventory. Shared
browser/tile checks select handle positions and mixed-device numeric channels
in DE/EN without creating rules or sending MQTT commands.

The bundled correction is Extension `0.2.4`, build `3f8a06859635`, pinned to
canonical commit `2db85997a2a317bee6c59e96d78c050b8c579095`. Final local verification
passes 219 desktop tests, with two native Linux APT cases skipped on Windows,
and the complete capture-free UI suite. The first concurrent UI run exceeded its
30-second process deadline after its DOM checks finished; the final isolated
`verify:local` passed with the pinned artifact in 15.3 seconds for the UI part.
Do not increase that deadline or use partial UI checks for sign-off.

Receiver-readiness regressions cover remote conditions, actions and sequence
references, distinct stopped/unknown/active states and stable system navigation.
Runtime integration tests verify saved rule-name previews, cancellation and
explicit partner-only activation without releasing local rules. The complete
Symcon browser/tile fixture verifies the real navigation, activation confirmation,
return path and language changes without capture or live systems.

Desktop CI on `dev` versions first through a reusable prerequisite, then checks
out that exact metadata commit in both platform jobs. The build-ref helper
verifies HEAD and version before tools or packaging run. Pull requests and `main`
keep read-only committed metadata. See [versioning](VERSIONING.md#build-order-and-immutable-checkout).
The Git-backed regression in `tests/ci-versioning.test.mjs` also covers manual
rebuilds, superseded pushes, failure gates and a branch advancing between the two
platform checkouts. No live repository push or package publication is part of it.
Local verification passed with 201 tests, the complete capture-free extension-
update UI fixture, and eight Git-backed workflow cases included in that count;
two native APT cases require Ubuntu. The ordered GitHub pipeline remains to be
confirmed after pushing this workflow change.

Actionlint 1.7.12 validates the workflow graph with two narrow local exceptions
for its stale `create-github-app-token@v3` input metadata. The current upstream
[action definition](https://github.com/actions/create-github-app-token/blob/v3/action.yml)
supports `client-id` and makes `app-id` optional. Keep that verified input; no
workflow-wide lint suppression or token-permission change is introduced.

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run setup:tools
npm run verify:local
npm run smoke
npm start
~~~

setup:tools explicitly invokes only the reviewed pinned Electron download. Do not
enable all dependency lifecycle scripts to work around missing tools.

`npm run verify:local` is the required local check before completing code changes.
It runs `npm run verify` and then the complete `test:extension-update-ui` fixture,
stopping with a failure if either stage fails. A successful `verify` alone is
not a complete local sign-off. The UI fixture uses a hidden Electron window and
captures no images; Linux without a desktop session needs Xvfb and the sandbox
setup shown in the CI workflow. CI retains its separate platform-specific steps.

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

`npm run test:extension-update-ui` is a mandatory part of `verify:local` and both
platform jobs. Its fixed asset list must include transitive designer imports,
including `layout.js` → `symcon-workspace.js` → `draft-sync.js`. It covers pending
update/transfer progress, automatic draft-check modes, the single check action,
explicit-transfer controls and DE/EN feedback.
Confirmation layout is checked in both themes. It captures no images. Backend
integration tests use the real pinned extension to verify consent, backup and
stop ordering, switch-only/unchanged drafts and lost replies without replay.
The DOM fixture also checks detailed capability findings in DE/EN, literal label
rendering, exact correction targets and bounded editor summaries. Draft smoke
opens a finding for the second value of a multi-property action and verifies
that only that value is marked and focused. Synthetic backend tests cover
multiple invalid values, disabled rules, shared sequences, foreign-device
ownership, numeric bounds/increments and exclusion of private feedback from logs.
Toggle regressions cover writable versus read-only state channels, untouched
read values, native TOGGLE selection/reopening in DE/EN, and validation, storage
and single execution of TOGGLE plus brightness through the real pinned extension
against isolated synthetic peers.
Operation-permission checks cover confirmed counts, zero-enabled explanations,
sorted checkboxes, DE/EN preservation, cancellation, stale selections and pending
transfer guards. DOM-only layout checks exercise long, independently scrollable
lists at 360/1280 pixels in both themes. Source smoke verifies system-scoped
selection preservation and prohibits permission writes from the smoke profile.
Tests with the real pinned extension verify switch-only storage, explicit consent,
backup cancellation, preservation of divergent drafts, revoking the last rule,
unknown/duplicate IDs and refusal to replay an unconfirmed stop.
The DOM regression also transitions between red **Not confirmed**, yellow
**Unknown** and green **Confirmed** permission states in DE/EN and checks the
actual palette colors in both themes. Selection edits, cancellation, stale
contexts, lost freshness and unresolved transfers/updates must not show a false
green confirmation. Starting or stopping operation does not change confirmed
permissions or issue additional control requests.
Step-8 receipt regressions cover enabled switch-only storage versus disabled
content storage, fresh readback counts in DE/EN, a later start, lost freshness
and a newer stored revision. Completed or invalidated transfers must not keep
planned-upload instructions or authorize another upload.
The desktop workspace layout regression uses the actual markup, shared layout
containers and desktop shell with 30 long synthetic rules. Both themes cover
1440-pixel windows down to 500 pixels high, a two-column workspace, 150% text
and a narrow stacked layout.
It verifies that the outer window does not scroll, the list remains bounded,
the last rule is reachable and keyboard focus reveals its name. Chromium wheel
input in light/dark and normal/short windows must actually scroll the list in
both directions while leaving its controls and outer containers stationary.
The fixture checks trusted, uncancelled events and the observed scroll position;
dispatching a synthetic DOM event alone is insufficient. Native OS input remains
part of installed-app acceptance. No image capture is used.
Layout checks wait for the renderer's requested viewport size and read actual
DOM geometry, without waiting for animation frames in the hidden test window.
Those frames can be delayed by seconds and previously exhausted the unchanged
30-second process limit. `EXTENSION_UPDATE_DOM_STEP` reports fixed phase names,
viewport/theme cases and elapsed time; each phase also has an eight-second
deadline. Process failures report timeout, elapsed time, exit code and signal.
These diagnostics contain synthetic test metadata only and capture no images.

Use `npm run smoke -- --no-capture` for the complete source smoke without images,
or `npm run smoke:packaged -- --no-capture` after packaging. The flag disables
both the success screenshot and failure screenshots; bounded JSON diagnostics
remain available. The runner rejects builds without capture-free support and
does not remove existing PNG diagnostics in this mode. Normal CI commands retain
their capture checks. Both modes execute the same functional, layout and
save-on-close checks. The draft check asserts classified state and transfer
eligibility rather than a fixed localized success sentence.

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

The shared adapter provides “Update from Z2M” in step 6 and portable file controls
in step 5. Symcon implements its fixed HTTP routes and native persistence; the
desktop maps the same surface to restricted main-process IPC. Connection reads
reconcile local drafts automatically. `tests/draft-sync.test.mjs` verifies request
scope, response bounds, operation identity and the absence of command retries.
The consumer's capture-free browser test covers both browser and tile workflows.

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
