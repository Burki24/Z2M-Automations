# Z2M-Automations beta user guide

## Install

Use the package for your platform. The reference systems are Windows 11 x64
and Ubuntu Desktop 24.04 LTS x64. Ubuntu Desktop 26.04 LTS is an additional
acceptance target. Development packages are unsigned.

- **Windows.** Open the x64 Setup EXE and choose German or English. Select
  installation for yourself or for all users. Windows asks for administrator
  approval for the all-users option. Choose a dedicated application folder.
  Setup adds a Start menu entry and offers to start the app on completion.
  See [Windows installation](WINDOWS_INSTALLER.md).
- **Ubuntu.** From a terminal in the directory containing the package, use
  `sudo apt install ./<package>.deb`, replacing the placeholder with the exact
  file name. Start Z2M-Automations from the application menu. The application
  language is configurable in the designer.

## Work with a project

1. Create or open a local project. Save the project to a location you control.
2. Add a broker and a Z2M system with its own base topic. Choose session-only
   credentials or protected storage. If the Linux keyring is unavailable,
   unlock it or choose session-only storage explicitly.
3. Connect to the broker and read the system. The draft and the stored Z2M
   revision are separate. Local edits need to be applied and the project saved.
4. Install the bundled extension only on the intended system when needed.
   Validate the draft, then confirm storage. Regular validation stores disabled
   rules. For automatic operation, change the intended enabled flags, validate
   those flags, store the revision and explicitly activate the system.
5. Use **Z2M operation** to start a stored rule once, stop a run or stop the
   entire system. Enable restart recovery only if the system should resume
   automatic operation after Z2M restarts. Closing the desktop app disconnects
   its broker client. The extension continues running.
6. Use **Desktop diagnostics** to start a one-minute recording. Select
   **Open recording** after events arrive to inspect the current session's
   recording.

## Update or return to an earlier version

1. Apply pending editor changes, save every open project and create a portable
   backup. Keep the previous installer, the pre-update backup and any required
   credential recovery information separately. Portable projects omit secrets.
2. Close the app. On Windows, run the newer setup with the same installation
   scope and directory. On Ubuntu, install the newer DEB with apt. These are
   manual application updates. Extension installation and activation are
   separate operations.
3. Reopen the project. Check its drafts, systems, stored revision and language.
   Verify credentials with the OS keyring or re-enter session credentials.
4. To return to an older build, keep the current project and its backup. On
   Windows, uninstall the newer app and run the older setup in the original
   scope. On Ubuntu, explicitly install the older DEB with
   `sudo apt install --allow-downgrades ./<older-package>.deb`.
5. Open a copy of the pre-update backup if the older application cannot read
   the current project format. Keep both copies until you have checked their
   drafts and system bindings. Application rollback does not roll back the
   extension or its stored rules.

## Uninstall

On Windows, remove Z2M-Automations through **Installed apps**. On Ubuntu,
run `sudo apt remove z2m-automations`. Retain your saved projects and backups
for future use. To stop automation, use **Stop all operation** on the intended
system before disconnecting. Removing the app does not stop the Z2M extension.
