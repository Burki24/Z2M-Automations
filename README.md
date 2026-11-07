# Z2M-Automations

A planned standalone application for creating and managing Zigbee2MQTT
automations on **Windows and Ubuntu Linux**, without a running Symcon instance.

The shared visual designer will manage up to eight Z2M systems using one or
more MQTT brokers. Automations will run in our own Zigbee2MQTT extension;
the desktop application can be closed after successful setup and activation.

**Status:** Repository and development guidelines are prepared. There is no
runnable desktop application, installer or desktop compatibility acceptance yet.
Successful tests of the existing Symcon integration are not desktop test results.

## Planned scope

- One shared codebase for Windows 11 x64 and Ubuntu Desktop LTS x64.
- German and English, with additional languages supported through catalogs.
- Device events, clock and solar times, conditions, scenes and reusable sequences.
- Direct MQTT connections, separate drafts per system and explicit transfer.
- Cross-system actions through suitable broker connections and directed permissions.
- System status, extension management and time-limited execution diagnostics.

## Project documents

- [Implementation plan and milestones D0–D7](docs/DESKTOP_PLAN.md)
- [Current project context](PROJECT_CONTEXT.md)
- [Development guidelines](AGENTS.md)
- [Architecture and shared source ownership](docs/ARCHITECTURE.md)
- [Development workflow and planned verification](docs/DEVELOPMENT.md)
- [Automatic application versioning](docs/VERSIONING.md)
- [D0 localization: implementation and verification](docs/LOCALIZATION.md)
- [Initial architecture decision](docs/adr/0001-parallel-desktop-platforms.md)

The separate [Symcon integration](https://github.com/Burki24/Symcon_Z2MAutomations)
currently owns the designer and Z2M extension sources. Their controlled reuse
is part of the plan; this repository does not contain an independently maintained copy.

## License and availability

The desktop application's license and distribution model have not been decided.
Existing source licenses remain applicable to their respective components.
No installer or release is available from this initial project setup.
