# ADR 0006: Reconcile connected workspaces and separate project/draft files

- Date: 2026-11-15
- Status: Implemented; live and platform acceptance remain separate.

## Decision

The first complete connection read initializes a network's local working copy.
Later reads compare that copy, the actual last accepted remote configuration and
the fresh remote document. Stable rule and sequence IDs identify entries; names
do not. Independent additions, edits and deletions merge automatically. Divergent
edits, edit/delete pairs and incompatible partner permissions require an explicit
local/remote choice. A legacy revision/checksum without content is not proof of
a common ancestor. Missing ancestor data is handled conservatively.

The pure canonical merge and draft-container functions live in the shared designer.
The build stages their exact function bodies as CommonJS for the desktop main
process. Native PHP enforces the same contract independently. Neither renderer
nor imported files may bypass authoritative validation, current bindings or the
local compare-and-swap. Choice application verifies a fresh remote read again.

Reading and merging only affect local work. Open forms are preserved, uncertain
reads do not trigger control retries, and lower remote revisions cannot roll back
local work. The desktop offers explicit offline editing before an initial read.
The native designer automatically requests one read per observed connection;
view-only refreshes do not repeat it. Native ownership/setup remains explicit.

Each applied merge/import creates a private automatic recovery snapshot. Undo
requires the exact resulting local state; later edits invalidate that shortcut.
The next upload continues to require fresh checks and separate confirmation.
Unresolved or failed reconciliation cannot be bypassed through the transfer API.
Unfinished working rules can still be read, combined and saved as drafts; complete
runtime schema/capability checks remain mandatory before transfer.
New rules and imported additions stay disabled. Existing remote switches are
preserved during reads; file imports cannot widen destination partner grants.

## File contracts and compatibility

- `.z2map` is the default standalone project extension. Project format 2 stores
  brokers, network ownership, local drafts, stored observations and the accepted
  base content. Credentials remain external. Format 1 and existing `.z2ma` files
  still open; saving writes format 2 without automatically renaming an old path.
- `.z2mad` is a versioned `z2m-automations-draft` JSON container with source-network
  identity, selected rules, required sequences and, for a complete export, the
  comparison base. It works in the app, browser designer and tile.
- Native `.z2map` workspace snapshots contain all assigned local network drafts,
  with no native instance authority or broker credentials. Both products can add
  rules from these snapshots or standalone project files to an explicitly chosen
  existing target network. Connection creation/ownership is never imported.
- YAML/JSON configuration exchange remains available separately. A portable draft
  adds entries; it does not replace the entire target workspace.

File selectors, source/target mapping, version choices and confirmation are shared
and localized. Native file-system dialogs and desktop reads/writes stay in main.
Browser downloads and user-selected browser files stay within the browser API.

## Verification

Synthetic tests cover independent changes, unknown bases, concurrent input,
interrupted reads, permission conflicts, private recovery, project reopen and
legacy formats. Capture-free Electron and browser/tile checks exercise the actual
controls. Required final commands and their evidence are recorded in DEVELOPMENT.
