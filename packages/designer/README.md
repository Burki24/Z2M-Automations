# Shared designer

**English | [Deutsch](README_DE.md)**

The shared rule editor includes restart_policy (abort, resume, resume_expired)
with German/English labels and lossless prefill. It edits only the local draft;
execution and durable waiting-run recovery remain owned by the Z2M extension.

Canonical HTML, CSS, JavaScript and local German/English JSON catalogs for the
Symcon and desktop products. The initial source was extracted from
Burki24/Symcon_Z2MAutomations at cd5cfc33c921365c69814078238444c3ea7d5ac5.
Existing PolyForm Noncommercial 1.0.0 notices remain in LICENSE.

Edit src here, then run npm run pack:designer from the repository root. This
produces a versioned local npm archive in artifacts, including license,
provenance and SHA-256 hashes for every delivered asset. The manifest content
identity covers the complete ordered asset map. Hashes detect changes; they
are not a publisher signature. No registry publication occurs.

Symcon consumes the reviewed archive using its tests/import-designer.mjs tool
and commits the resulting pinned files. Its checks verify that manifest without
requiring this repository, a network download or a desktop runtime. Its native
tile, central interaction helper, PHP adapter and Z2M extension remain owned by
their existing repositories. Do not edit the delivered designer files there.

native-messages.json preserves the existing Symcon presentation templates,
including printf placeholders. It is adapter data; no PHP interpreter is needed
to build or run the desktop. Keep native message changes and catalog keys in
sync when subsequently updating that adapter.

transport.js is the product boundary: the web adapter retains its authenticated
fetch contract; the desktop installs a fixed IPC adapter before reader.js. Each
backend validates its own local editing, file, reconciliation and explicit control
requests. draft-merge.js provides the pure identity-based merge and portable
container functions; the desktop build stages their exact bodies for main-process
use. draft-files.js and draft-sync.js provide the shared DE/EN controls. Native
file dialogs, general file access, credentials and MQTT remain outside the renderer.
