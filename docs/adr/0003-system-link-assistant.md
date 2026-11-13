# ADR 0003: Read-only assistance for connecting Z2M systems

- Date: 2026-11-11
- Status: Implemented for the standalone desktop app.

## Decision

Expose a three-stage assistant in workspace step 3: select two systems, check
prerequisites, and review configuration suggestions. Keep the shared designer,
Symcon interfaces and canonical extension/schema unchanged. Dynamic Security
administration and automatic server setup are outside this change.

The main process validates stable, distinct system IDs. Viewing a plan makes
no network requests. An explicit check starts ordinary correlated status/editor
reads for both selected systems on already connected brokers. It neither
connects disconnected brokers nor publishes mesh probes or control commands.
Reads finish through the existing observation queue; do not await those
callbacks while holding that queue. The open dialog polls projections and
invalidates its session when the project is replaced. Project-file writes,
transfers and runtime changes remain separate actions.

Distinguish local permissions, freshly stored permissions and permissions in
the matching active revision. Cached observations cannot pass a live check.
Actual Z2M/bridge credentials, their ACLs and end-to-end mesh transport remain
unverified, even when the app connection and all Z2M observations succeed.

Generate supplementary `mesh_peers` and Mosquitto ACL excerpts with existing
local peers preserved. Never exceed eight peers, guess an ambiguous base topic,
include actual credentials, or generate configuration directives from display
names. Brokers sharing a configured endpoint need no additional bridge. For
different endpoints, show one bridge on the first broker with
`topic z2ma/mesh/# both 0`, clean sessions, unique client IDs and no retained
notification topics. Use password/account placeholders and, for TLS, server-side
CA/client-certificate placeholders with certificate verification enabled.

Examples supplement existing server configuration. They do not discover an
existing bridge topology, resolve host aliases, enable authentication, create
accounts or replace complete configuration files. A server administrator must
review existing routes and avoid loops, replace placeholders, protect secret
files and reload/restart as appropriate for the installed Mosquitto version.

## Evidence and limits

Unit/integration tests exercise bounded templates, ambiguous ownership, stale
state, failed reads, version checks and isolated MQTT peers. A separate hidden
Electron DOM test covers the assistant without image capture. The workflow
includes that test in both platform jobs. A local Windows pass is not Ubuntu acceptance or evidence
about the user's live broker accounts and bridges.

Protocol/configuration references:

- [Mosquitto authentication](https://mosquitto.org/documentation/authentication-methods/)
- [Mosquitto configuration, ACLs and bridges](https://mosquitto.org/man/mosquitto-conf-5.html)
- [Dynamic Security administration](https://mosquitto.org/documentation/dynamic-security/)
