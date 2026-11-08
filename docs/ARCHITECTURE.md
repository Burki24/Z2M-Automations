# Architecture

Status: D1 complete with Windows/Ubuntu CI evidence; D2 local project/vault
implementation is available with platform CI and native acceptance still open.
Current behavior is described in [D1](D1.md) and [D2](D2.md). Decisions and complete
milestones are described in [ADR 0001](adr/0001-parallel-desktop-platforms.md)
and the [desktop plan](DESKTOP_PLAN.md).

## Shared application for two platforms

Windows and Ubuntu use the same designer and business logic. Platform-specific
concerns are file paths, dialogs, protected secret storage, desktop integration
and packages. Do not maintain different feature sets per operating system.

Responsibilities (local D2 services currently live in `apps/desktop/src`;
core, mqtt and platform packages are not empty placeholders):

| Area | Responsibility |
| --- | --- |
| `apps/desktop` | Electron main process, preload, windows and package configuration |
| `packages/designer` | Canonical shared interface and language catalogs |
| `packages/core` | Drafts, schema/capability validation, conflicts and adapter contracts |
| `packages/mqtt` | Broker connections and correlated Z2M requests |
| `packages/platform` | OS paths, dialogs and protected credentials |
| `tests` | Synthetic contract, integration, UI and platform cases |

The interface uses a defined adapter contract. The Symcon adapter stays in the
Symcon repository; the desktop adapter runs behind restricted IPC. The renderer
has no Node access, broker secrets or MQTT clients.

## One canonical source per component

| Component | Canonical source | Consumption |
| --- | --- | --- |
| Designer | `packages/designer/src` | Versioned archive with provenance, license and hashes; pinned in Symcon |
| Z2M extension and schema | `Symcon_Z2MAutomations/libs/z2m` | Remains canonical there; desktop bundles a verified artifact with provenance and build identity |
| Symcon helpers | `Symcon_ModuleHelper` and its unchanged consumer package | Continue using them in the Symcon adapter; no PHP copies or new desktop PHP runtime |
| Local projects and credentials | `apps/desktop/src/project*.ts`, `credentials.ts`, `os-protection.ts` | Validated main-process commands; portable drafts and an independent secret vault |

The extraction preserves the PolyForm notice, native presentation templates
and Symcon endpoint behavior. Its fixed asset allowlist includes transport.js. Do not silently use a sibling
repository as a build source. Distributed packages contain pinned assets;
there are no runtime downloads from GitHub.

## Systems, data and requests

- Model broker connections and Z2M systems separately. Several base topics may
  share a broker; explicitly assign up to eight systems.
- Identities are stable system/device/rule identifiers. Display names may change.
- Store portable projects separately from secrets. Private keys and sessions
  belong in neither exports nor diagnostics nor the repository.
- Keep drafts, Z2M base revisions/checksums and confirmed operational state
  separate. Saving compares against fresh state and reports conflicts.
- Reconnection does not automatically repeat unacknowledged control requests.
  A local Symcon owner identifier is not a cross-installation lock.
- The application does not execute rules itself. Z2M remains the runtime;
  broker bridges are configured separately and are not installed by the app.

## Language, permissions and diagnostics

Visible messages carry keys and parameters. The designer resolves them using the
selected language; protocol values and user-defined names remain unchanged.
Device actions require confirmed Z2M write permissions. Sensors remain available
as readable triggers and conditions.

All requests and decisions are traceable through structured, sanitized events.
System, request, rule, run and step identifiers connect local diagnostics to
extension messages. Recording start, fixed end time and stop are explicitly
visible. A request succeeds only after its matching acknowledgement; a physical
device effect must be verified separately.
