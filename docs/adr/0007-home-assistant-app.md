# ADR 0007 — Z2M-Automations for Home Assistant

**English | [Deutsch](0007-home-assistant-app_DE.md)**

- 2026-11-20
- Status **Proposed**

## Product scope

Start with a Home Assistant OS app (formerly an add-on). Serve the shared
designer in the Home Assistant sidebar through Ingress. Use `amd64` for the
first test image and verify `aarch64` before claiming support for it. Home
Assistant Container does not run Supervisor apps. A Home Assistant Core
integration for entities or actions can be evaluated if there is demand for
those capabilities. [Home Assistant installation types](https://www.home-assistant.io/installation/#about-installation-types),
[Ingress guide](https://contributors.home-assistant.io/apps/guides/ingress/).

Propose a separate application repository and release identity, following the
desktop and Symcon product split. Development and testing can start locally
while the Canonical forum decision is pending.

## Components and boundaries

- Consume the canonical designer as a pinned package with version, provenance,
  license and asset hashes. Supply a Home Assistant adapter with relative URLs
  and DE/EN catalogs. The current browser entry point relies on Symcon bootstrap
  data, token renewal and web routes. The desktop adapter relies on Electron
  preload. Extract shared seams where the first working slice needs them.
  [Shared designer package](../../packages/designer/README.md).
- Use a Node.js backend for the browser API and MQTT. Reuse the correlated
  request logic from `mqtt-reader.ts` and `mqtt-protocol.ts` by extracting the
  needed platform-independent code into a shared source. Preserve system
  ownership, session, revision, checksum and timeout checks. Keep the existing
  `/symcon/automations/` MQTT suffix for wire compatibility. Rules continue to
  run in the existing Zigbee2MQTT extension when the app is closed or removed.
  Use the observed extension build and the pinned schema when assessing
  compatibility. [Current architecture](../ARCHITECTURE.md).
- Use the Supervisor's MQTT service when configured and offered. Allow an
  explicitly configured external broker with TLS verification. Keep MQTT
  clients, broker credentials and Supervisor tokens server-side. Accept HTTP
  only from Supervisor Ingress. Use `panel_admin: true` and test with Supervisor
  2026.10.2 or newer, which enforces administrator access at the proxy. Validate
  the request origin and body before enabling any future write routes. Use
  fixed API routes and only the required broker topics.
  [MQTT service discovery](https://contributors.home-assistant.io/apps/guides/services-discovery/),
  [Supervisor 2026.10.2 release notes](https://github.com/home-assistant/supervisor/releases/tag/2026.10.2).

## First working slice

1. Open the shared designer under an Ingress path. Load the German and English
   catalogs and render one configured Z2M system identified separately from its
   broker and base topic.
2. Connect to an isolated synthetic broker. Show extension status, the device
   catalog and saved rules using the existing `status → editor → status` exchange.
   Expose a read-only view. A missing, stale or mismatched response produces a
   localized failure state without presenting old data as current.
3. Verify with a simulated Ingress prefix and MQTT peer, then with a disposable
   Home Assistant OS installation. Check nested asset/API URLs, authorization,
   system ownership and a broker trace containing only non-retained read
   requests. Use synthetic data and capture-free tests.

Later slices can add local draft editing and `.z2mad` exchange, multiple Z2M
systems and explicit transfer and operation controls. Enable writes after
verifying protected credential storage, concurrent desktop/Symcon/HA edits,
fresh-state comparisons, conflict backups and independent acknowledgements.

## Local feasibility check

On 2026-11-20, a temporary Node.js server on loopback served the verified
designer entry assets and both catalogs under a simulated Ingress prefix. A
read-only HTTP route returned the revision, checksum, rules and device catalog
from the existing MQTT reader. The synthetic peer recorded three non-retained
read requests. Running the designer with a Home Assistant adapter and verifying
real Ingress authentication in Home Assistant OS are open acceptance checks.
