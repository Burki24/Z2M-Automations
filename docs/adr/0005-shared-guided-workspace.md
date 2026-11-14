# ADR 0005: Shared guided workspace for desktop and Symcon

- Date: 2026-11-13
- Status: Implemented locally; native Symcon acceptance after updating remains separate.

## Decision

Extract the accepted desktop navigation and viewport layout into
`packages/designer/src/guided-workspace.js` and `guided-workspace.css`. Both
products use the same numbered shell, automation list, flow, inspector, form and
localized validation explanations. Preserve the existing scrolling element and
its responsive fold; moving the fold into its own tools area would break wheel
handling. The desktop entry point re-exports the shared implementation.

The Symcon presentation adapter is shipped in the same versioned designer
archive. Its PHP authority, persistence, native tile, embedding and interaction
helpers remain canonical in the Symcon repository. Symcon consumes checked,
pinned assets rather than editing a second UI implementation. Product palettes
remain independent semantic-token providers.

## Native adaptation

Symcon uses an existing automation centre, MQTT parents and per-system documents
instead of portable desktop projects and a desktop credential vault. The first
pages explain these native settings and list existing connections. Explicit
system assignment reuses native candidate, ownership and fingerprint checks.
Only the configuring access session receives the changed scope. Other sessions
must reopen; credentials never enter the shared UI.

Checking remains a separate step from transmission. Findings identify the rule
and field and can open that field in the common editor. Step 8 captures explicit
consent, obtains fresh operating status, stops operation/restart intent/remaining
runs when necessary, revalidates and stores once through the existing scoped
native protocol. Cached GET polling is bounded and never replays a mutation.
Starting operation remains a separate action. Native enabled flags and runtime
backup semantics remain native; the desktop backup dialog and disabled-content
policy are not silently imposed on Symcon.

The native adapter exposes the confirmed `resumeStatus` separately from the
saved restart preference. `stopped` confirms a disarmed durable intent while
preserving that preference; the guided transfer may then validate and store.
An enabled preference alone does not indicate active restart intent. Missing or
still armed confirmation after a stop prevents storage without replaying it.

The native Operation page can change a rule's local enabled flag through the
existing authenticated edit endpoint. Checking and transmission remain explicit.
Stored enabled counts require a matching confirmed document. A local checkbox
does not establish an effective permission in Z2M.

## Verification

Use synthetic PHP kernel/MQTT peers and headless browser/tile fixtures. Verify
assignment rights and session scope changes, exact local edits, field correction,
cancellation, stop/check/store ordering, missing acknowledgements, DE/EN input
preservation, responsive layout and actual wheel movement. No live system access
or image capture is necessary. Desktop source smoke and the existing wheel/layout
regression protect the accepted application during extraction.
