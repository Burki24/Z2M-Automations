# ADR 0002: Portable local projects and a separate credential vault

- Date: 2026-11-08
- Status: Implemented for D2; platform acceptance is tracked in [D2](../D2.md).

## Decision

Use a bounded, versioned JSON project envelope with stable project, broker and
system identities. Keep drafts and their known remote baseline per system.
The current local services live behind the desktop preload boundary in
`apps/desktop/src`; they have no Electron dependencies except the OS adapter
and main-process integration. Do not create empty future package shells.

Only main may choose paths and read/write projects. Save detects external
changes, preserves a previous-version backup and atomically replaces the file.
Restoring a backup modifies only local memory until explicitly saved. Portable
exports retain identities and draft contents but exclude all credentials.

Use a separate OS-encrypted credential vault scoped to project and broker
endpoint. Expose import/remove/status operations, with no renderer readback.
Main selects and reads a bounded private credential JSON file through its own
system dialog; username and password never enter the designer or its IPC payloads.
Explicit session-only storage is available when protection is unavailable;
never downgrade silently. No credential or project operation starts MQTT.

On Electron 45, Linux protected storage uses the synchronous availability,
recognized keyring backend and encryption/decryption APIs. The newer async
availability API can report an initialized encryptor even with a fallback
provider, so it is insufficient as the sole Linux protection check. Windows
uses the async API. Reassess the Linux adapter before upgrading to Electron 46;
the pinned dependency and current guard must not be silently bypassed.

## Consequences

Drafts are safe to open without connected systems. D2 supports project and
draft lifecycle, while runtime schema/capability validation and full editing
remain later milestones. OS dialogs and the native Linux keyring require
platform acceptance in addition to synthetic service tests. A project backup
is private user data; it belongs outside repositories and diagnostics.
