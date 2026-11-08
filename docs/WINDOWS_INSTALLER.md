# Windows installer with a selectable directory

The Windows package now uses an assisted NSIS installer through the pinned
`electron-forge-maker-nsis` 26.18.0. This replaces Squirrel.Windows: its fixed
per-user installation path did not meet the requested directory selection.
Ubuntu continues using the existing Forge Debian maker.

Run `Z2M-Automations-<version>-Windows-x64-Setup.exe`, select German or English,
then choose a dedicated installation directory, for example
`E:\Programs\Z2M-Automations`. The installer runs per user without elevation.
Its completion page offers a localized checkbox to start the application when
finishing; clear it to finish without launching. Setup creates a per-user Start
menu entry named `Z2M-Automations`. Windows lists the installed app
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

The configuration test checks directory selection, per-user/no-elevation mode,
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

Primary references: [official Forge integration](https://www.electron.build/v26/docs/features/electron-forge/)
and [NSIS options](https://www.electron.build/nsis/). This decision supersedes the
initial Squirrel packaging choice in the desktop plan, not the shared application
architecture.
