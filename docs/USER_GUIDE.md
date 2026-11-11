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
  file name. Start Z2M-Automations from the application menu.

Use **Language** in the app header to choose German or English.

## Work with a project

The numbered steps are on the left. In a narrow window, use the **Workflow
step** list. An existing project with a configured system opens in **Edit
automations**. The system selector above the work area sets the target for
reading, editing, checking and transfer.

1. **Open or create a project.** Save the project to a location you control.
2. **Set up broker.** Apply the broker settings, then choose an explicit
   credential storage mode if the broker requires authentication. Use **Enter
   credentials** or **Import credentials** from a private JSON file. Direct
   entry opens a separate OS dialog. If protected storage is unavailable,
   unlock the keyring or explicitly choose session-only storage.
   **Connect automatically when opening this project** offers saved credentials
   or an explicit choice to connect without authentication. The selection is
   saved immediately on this computer for this project and broker address.
   On the next project open, each enabled broker connects once and reads its
   assigned systems. Missing credentials or a locked keyring show a corrective
   message in the workspace, broker setup and connection step. After adding
   credentials or unlocking the keyring, choose **Connect and read Z2M state**.
   Session credentials must be entered again after opening a project.
3. **Assign a Z2M system.** Choose its broker and enter its base topic.
4. **Connect and read Z2M state.** Read devices and the stored configuration.
   The bundled extension is available under **Z2M extension** when needed.
5. **Choose a starting point.** Edit the local draft, import a YAML or JSON
   file, or copy the configuration stored in Z2M into the draft. **Export
   draft YAML** creates an optional file from the selected system's local
   draft. Copy the stored configuration first if you want to add to existing
   rules. Replacing a draft requires a project backup.
6. **Edit automations.** Enter a name, a trigger, optional conditions and
   actions. Choose **Device status**, **Measured value**, **Time**, **Sunrise**
   or **Sunset** as the trigger. Status lists discrete values such as motion
   detected or a button press. Measured values list numeric properties such
   as temperature and brightness. Device and property lists show matching
   choices. Conditions also distinguish status from measured values.
   **Add to draft disabled** adds the new rule to the local project.
   Save the project in step 1 to keep those changes.
7. **Check draft.** The check is also available directly from step 6. Use a
   finding's **Go to the draft field** button to correct the affected entry.
   An offline check covers the local format. Read the system in step 4 and
   check again to prepare a transfer.
8. **Transfer to Z2M.** Review the target and confirm the transfer of the
   complete checked draft. A regular transfer stores the rules disabled.
   Existing stored state is backed up before replacement.

Use **Operation** to run a stored rule once, stop a run or stop the system.
To enable rules for automatic operation, change the rule switches in the
local draft, choose **Check enabled rules** in step 7 and transfer the flags
in step 8. Start automatic operation explicitly in **Operation**. Closing the
desktop app disconnects its broker client. The extension continues running.

**Desktop diagnostics** in step 1 records events for one minute. Use **Open
recording** after events arrive to inspect the current session's recording.

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
