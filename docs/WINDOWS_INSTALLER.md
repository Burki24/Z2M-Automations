# Windows installer with a selectable directory

**English | [Deutsch](WINDOWS_INSTALLER_DE.md)**

The Windows package now uses an assisted NSIS installer through the pinned
`electron-forge-maker-nsis` 26.18.0. This replaces Squirrel.Windows: its fixed
per-user installation path did not meet the requested directory selection.
Ubuntu continues using the existing Forge Debian maker.

Setup has a branded welcome page and matching finish/uninstall artwork: a large
app icon in a warm dark left sidebar. The intermediate pages, including the
installation-scope and directory choices, use a larger left-hand logo header.
The artwork contains only the product name, so the same images work in German
and English while the wizard text remains natively localized. Native buttons,
installation permissions and directory selection keep their standard behavior.

The committed 24-bit BMP assets in `apps/desktop/installer` use NSIS's recommended
150x57 header and 164x314 sidebar sizes with aspect-preserving DPI scaling.
Regenerate them on Windows from the existing app icon with
`./scripts/build-installer-artwork.ps1`. This draws artwork without screen
capture. Windows builds consume the committed bitmaps; neither platform build
requires an additional graphics tool or PowerShell generation step.

Run `Z2M-Automations-<version>-Windows-x64-Setup.exe`, select German or English,
then choose whether to install for the current user or all users. Windows
requests administrator approval for the all-users option. Choose a dedicated
installation directory, for example
`E:\Programs\Z2M-Automations`. The current-user option runs without elevation.
Its completion page offers a localized checkbox to start the application when
finishing; clear it to finish without launching. Setup creates a Start menu entry in the selected scope named `Z2M-Automations`. Windows lists the installed app
for uninstallation. Uninstall preserves application user data and credentials.

The chosen directory contains application binaries and the uninstaller.
Application preferences and the protected credential vault remain in the
Windows user profile on C:. Portable projects use the location selected when
saving them. Windows and setup temporary files still require free space; moving
the application does not eliminate that requirement. With a small system drive,
setup can be launched from PowerShell with process-local temporary paths:

~~~powershell
$setupTemp = 'E:\Temp\Z2M-Automations-Setup'
New-Item -ItemType Directory -Force $setupTemp | Out-Null
$env:TEMP = $setupTemp
$env:TMP = $setupTemp
& 'E:\path\Z2M-Automations-0.11.0-Windows-x64-Setup.exe'
~~~

No Squirrel installation is silently removed or migrated. If a previous attempt
installed an app, uninstall that entry explicitly before changing installer
families. A failed Squirrel attempt is not proof of a completed installation.

## Build and verification

Use the normal `npm run make` command. Forge stages the verified production
closure; NSIS wraps that exact prepackaged directory. Application and installer
versions come from `version.json`, not the source package version. The stable
installer application ID is `de.kneiseler.z2m-automations`. Build tools are pinned
through the lockfile; their integrity-checked NSIS/7-Zip downloads happen at build
time. `setup:tools` now invokes only the reviewed Electron download lifecycle.
No installer or application auto-update/publishing is enabled.

The configuration test checks directory selection, selection of installation scope and elevation for all users,
both languages, preserved user data and canonical version propagation. Local
Windows `npm run verify` (45 tests), NSIS `npm run make` and packaged Electron/MQTT smoke passed. GUI
automation was unavailable in this session. A real silent per-user installation
into a dedicated directory on E: succeeded; the installed ASAR matched the staged
ASAR's SHA-256. The installed executable passed the complete synthetic Electron/
MQTT smoke. Silent uninstallation removed that test application and its Windows
uninstall registration. These tests used process-local TEMP/TMP on E: and no
real broker or private project. Manual directory-dialog and localized
wizard acceptance remain separate. The new Windows/Ubuntu CI run is pending.
The installer is unsigned development material, not a published release.

The German completion title needs three lines at the standard wizard width.
Our small `installer.nsh` include reserves that title height for installation
and uninstallation, using NSIS Modern UI's supported three-line setting. The
stock localized text and the content area below it are preserved.

Branding verification on 2026-11-17: the actual Windows setup build succeeds.
A separate build with an isolated test application ID exercises the same
artwork/include and native DE/EN welcome, scope and directory pages without
installing. Control metadata confirms the loaded 164x314 sidebar, 150x57 left
header, two scope options, a directory field and no header/title overlap.
No window capture is used. Finish/uninstall page appearance and other DPI or
high-contrast settings remain manual acceptance; no Ubuntu build was run for
this Windows-only presentation change.
The isolated full `npm run verify:local` passes 248 tests (two Ubuntu-only skips)
and the complete capture-free UI test. The first run passed all unit tests but
hit the existing UI fixture's `load-workspace` deadline; its timing cause remains
unresolved. No shared renderer source or timeout was changed.

Primary references: [official Forge integration](https://www.electron.build/v26/docs/features/electron-forge/)
and [NSIS options](https://www.electron.build/nsis/). This decision supersedes the
initial Squirrel packaging choice in the desktop plan, not the shared application
architecture.
