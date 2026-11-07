# Z2M-Automations

A standalone Zigbee2MQTT automation designer for **Windows and Ubuntu Linux**.
The shared designer will manage up to eight systems on one or more MQTT brokers.
Automations will run in our own Z2M extension, independently of the application.

**Current state:** D1 provides a runnable offline desktop foundation with two
synthetic example systems, local German/English translations and bounded debug.
It does not connect to brokers or save user projects yet. Windows build and
runtime checks are available; native Ubuntu verification remains open.

## Run the development application

Install Node 24.20.0, then run from a standalone clone:

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run setup:tools
npm start
~~~

Only the reviewed Electron download and Windows installer-tool selection run in
setup:tools. It does not connect to Z2M. For diagnostics, expand "Desktop
diagnostics" below the designer and start a one-minute recording.

~~~sh
npm run verify
npm run smoke
npm run make
~~~

make builds a Windows setup EXE on Windows or an Ubuntu .deb on Linux. The output
is unsigned development material, not a release. Linux additionally needs
fakeroot/dpkg and a display (Xvfb for CI). See the platform limitations in
[the D1 implementation note](docs/D1.md).

## Planned scope

- Shared Windows 11 x64 and Ubuntu Desktop LTS x64 application.
- German and English through local JSON catalogs; no translation service.
- Device events, clock/solar times, conditions, scenes and reusable sequences.
- Direct MQTT, separate drafts, explicit transfer and cross-system actions.
- Extension management, system status and time-limited execution diagnostics.

## Project documents

- [Implementation plan D0–D7](docs/DESKTOP_PLAN.md)
- [Project context](PROJECT_CONTEXT.md) and [development rules](AGENTS.md)
- [Architecture](docs/ARCHITECTURE.md) and [development commands](docs/DEVELOPMENT.md)
- [Automatic versioning](docs/VERSIONING.md) and [localization](docs/LOCALIZATION.md)
- [Shared designer package](packages/designer/README.md)

The [Symcon product](https://github.com/Burki24/Symcon_Z2MAutomations) consumes
our pinned designer package. Its Z2M extension remains canonical there; neither
application embeds a PHP runtime or needs a sibling checkout at runtime.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Existing designer copyright notices are
retained. Third-party dependencies keep their own licenses. No signed installer
or published desktop release is available yet.
