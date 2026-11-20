# Documentation

**English | [Deutsch](README_DE.md)**

Start with the [user manual](USER_GUIDE.md) for installation and everyday use.
Every first-party Markdown document has a complete German companion ending in
`_DE.md`. Use the language link below each title to switch versions. English is
the authoritative technical reference; both versions are maintained together.
Commands, protocol values, identifiers and original license texts are unchanged.

## Using the application

| Document | Purpose |
| --- | --- |
| [User manual](USER_GUIDE.md) | Twenty chapters with sixteen English app screenshots: setup, examples, drafts, operation, updates and troubleshooting. |
| [Windows installer](WINDOWS_INSTALLER.md) | Language, installation scope, directory selection and build/acceptance limits. |
| [Screenshot provenance](images/README.md) | Matching German/English image sets, capture scope and permission requirements. |
| [Project overview](../README.md) | Product, features, local startup and licensing. |

## Developing and verifying

| Document | Purpose |
| --- | --- |
| [Development](DEVELOPMENT.md) | Setup, mandatory checks, capture-free tests, packaging and platform evidence. |
| [Development rules](../AGENTS.md) | Repository scope, localization, data boundaries and user-owned Git operations. |
| [Project context](../PROJECT_CONTEXT.md) | Current implementation and recorded verification. |
| [Architecture](ARCHITECTURE.md) | Shared designer, product adapters, systems, requests and credential boundaries. |
| [Implementation plan](DESKTOP_PLAN.md) | Goals, original planning decisions and D0–D7 completion criteria. |
| [Localization](LOCALIZATION.md) | Local DE/EN catalogs, input preservation and shared integration checks. |
| [Versioning](VERSIONING.md) | Automatic metadata, ordered immutable build handoff and version authority. |
| [RC1 preparation](RC1.md) | Audit remediation, candidate manifests and focused native acceptance. |
| [Shared designer package](../packages/designer/README.md) | Canonical sources, provenance, package handoff and adapter contract. |
| [Frozen extension fixture](../tests/fixtures/extension-0.2.0/README.md) | Origin and checksum of the immutable regression-test artifact. |

`npm run check:docs` checks language pairs, navigation, local links and the
manual screenshot mapping without capturing images. It runs in `npm run check`,
so it is included in local mandatory verification and both desktop CI jobs.
It cannot judge translation meaning or visual screenshot quality; review those
when the corresponding content changes. Follow the current capture-permission
rules before generating any new images.

## Milestone records

These records retain the tests and limitations of their named implementation
stage. Use the current manual and project context for present-day behavior.

| Milestone | Record |
| --- | --- |
| D1 | [Shared desktop foundation](D1.md) |
| D2 | [Local projects, drafts and protected credentials](D2.md) |
| D3 | [Read-only MQTT](D3.md) |
| D4 | [Local editing and private draft exchange](D4.md) |
| D5 | [Extension installation and storage](D5.md) |
| D6 | [Activation and operation](D6.md) |
| D7 | [Installed beta and subsequent workflow acceptance](D7.md) |

## Architecture decisions

| Decision | Record |
| --- | --- |
| ADR 0001 | [Shared Windows/Linux application](adr/0001-parallel-desktop-platforms.md) |
| ADR 0002 | [Portable projects and separate credential vault](adr/0002-local-projects-and-credential-boundary.md) |
| ADR 0003 | [Read-only system-link assistant](adr/0003-system-link-assistant.md) |
| ADR 0004 | [Common draft check and guided transfer](adr/0004-guided-draft-transfer.md) |
| ADR 0005 | [Shared desktop/Symcon workspace](adr/0005-shared-guided-workspace.md) |
| ADR 0006 | [Connected reconciliation and portable project/draft files](adr/0006-draft-reconciliation-and-portable-files.md) |
| ADR 0007 | [Proposed Home Assistant OS app](adr/0007-home-assistant-app.md) |
