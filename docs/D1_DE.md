<a id="d1-shared-desktop-foundation"></a>

# D1: gemeinsame Desktop-Grundlage

**Deutsch | [English](D1.md)**

Stand: D1 ist seit 2026-11-08 für Offline-Grundlage und CI abgeschlossen.
Beide Plattformjobs bestanden mit demselben Quellcommit. Die CI belegt weder
eine Abnahme installierter Desktop-Apps noch allgemeine Betriebssystemunterstützung.

Die Anwendung verwendet Electron 45.2.3, Electron Forge 8.0.1 und TypeScript
7.0.2 mit festen Versionen in package-lock.json. Build-Werkzeuge nutzen Node
24.20.0. Nach Bestätigung des Eigentümers steht die gesamte Anwendung unter
PolyForm Noncommercial 1.0.0. Der ursprüngliche gemeinsame Designer behält
seinen bisherigen Hinweis.

<a id="available-behavior"></a>

## Verfügbares Verhalten

- Eine Offline-Anwendung mit dem maßgeblichen Designer und lokalen DE-/EN-Katalogen.
- Zwei isolierte synthetische Systeme mit jeweils eigener ausgeschalteter
  Beispielregel und eigenen Gerätekennungen. Auswahl und Sprachwechsel erhalten
  die Sucheingabe.
- Responsives helles/dunkles Layout und übersetzte, ausdrücklich gestartete
  Diagnose: höchstens 200 Ereignisse und eine Minute. Lesen und wiederholtes
  Starten verlängern die Endzeit nicht.
- Renderer-Sandbox, Kontextisolation und feste Preload-Schnittstelle für Lesen,
  Beispielsystemauswahl, Sprachdiagnose und Aufzeichnungssteuerung.
- Jede IPC-Anfrage prüft den eigenen Hauptrahmen, den genauen lokalen Ursprung
  und die Nutzdaten. Das lokale Protokoll liefert ausschließlich vorbereitete
  Dateien. Netzwerknavigation, Downloads, Berechtigungsanfragen und zusätzliche
  Fenster sind gesperrt. Der Renderer erhält keine allgemeine Datei-, Shell-,
  Roh-IPC-, MQTT- oder Veröffentlichungs-API.
- Forge erzeugt aus denselben Quellen eine Windows-Setup-EXE und eine Ubuntu-DEB.
  Anwendungs-/Paketversionen werden beim Bauen aus version.json gelesen.

Diese Grundlage verbindet sich weder mit Brokern noch erstellt oder speichert
sie Benutzerprojekte. Die Beispielregeln können nicht ausgeführt werden. Das
sind spätere Meilensteine, keine verborgenen Funktionen der damaligen EXE.
PHP- oder Symcon-Laufzeit werden nicht mitgeliefert.

<a id="source-handoff"></a>

## Quellübergabe

Die maßgebliche Oberfläche liegt jetzt in packages/designer/src. Symcon verwendet
ein versioniertes Archiv mit Dateiprüfsummen, Lizenz und Herkunftsnachweis, das
in dessen Repository eingecheckt wird. Keines der Produkte benötigt zur Laufzeit
oder zur Prüfung seiner eigenen eingecheckten Eingaben einen benachbarten Klon.
Siehe [Paketvertrag](../packages/designer/README_DE.md). Erweiterung und Schema
bleiben im Symcon-Repository maßgeblich und werden durch D1 nicht verändert.

<a id="verification"></a>

## Prüfung

Lokale Umgebung: Windows 11 Pro Insider Preview, Build 28120, x64; Node 24.20.0 /
npm 11.19.0. Dies ist kein Nachweis für jede Windows-11-Version.

Die Windows-Prüfung verwendet den echten isolierten Electron-Renderer und die
gepackte Anwendung: beide Systeme, DE-/EN-Wechsel, Erhalt von Eingaben und
Konfiguration, erlaubte Schnittstellenschlüssel, abgelehnte ungültige Anfragen,
Diagnosestart/-stopp und Layouts mit 360/1920/3840 Pixeln in beiden Designs.
Unit-Tests prüfen unabhängig die Ablehnung von Absendern/Nutzdaten,
Protokollpfade, begrenzte Aufzeichnung und automatischen Ablauf. Das Windows-Setup
ist nicht signiert und ausschließlich für Entwicklung gebaut; es ist weder
eine Abnahme der installierten App noch eine Veröffentlichung.

Der Desktop-Workflow führt dieselben Build-/Prüf-/Test-/Paket-/Smoke-Schritte auf
windows-2025 und ubuntu-24.04 aus. Linux verwendet Xvfb und die ausschließlich im
wegwerfbaren CI-Runner konfigurierte Chromium-Sandbox. Die Renderer-Sandbox wird
nie deaktiviert. Der erste [Desktop-CI-Lauf](https://github.com/Burki24/Z2M-Automations/actions/runs/42377767843)
prüfte Quellcommit `dbcd466c7a0259cbe2d2bc71caa9703e453917f5` am 2026-11-07.
Windows bestand alle Schritte. Ubuntu bestand Kompilierung, Prüfungen, sechs
Vertragstests, `.deb`-Erzeugung und funktionale Renderer-Zusicherungen
(`DESKTOP_SMOKE_OK`), scheiterte dann vor der abschließenden Layoutmarkierung mit
`UnknownVizError`. Die verbleibende asynchrone capturePage-Anfrage ist die
vermutete Fehlergrenze; das ursprüngliche Protokoll kennzeichnete einzelne
Layout-/Aufnahmephasen nicht.

Die Folgeänderung hält das Linux-Smoke-Fenster auf einer Xvfb-Anzeige mit
3840x2160 eingeblendet, damit capturePage eine sichtbare Rendering-Fläche hat.
Windows-Smoke bleibt verborgen. Markierungen je Fenstergröße und Aufnahme
kennzeichnen jetzt die Fehlerphase; eine leere Aufnahme scheitert ausdrücklich.
Keine Sandbox-Einstellung wird gelockert, keine fehlgeschlagene Aufnahme
ignoriert. Der folgende Lauf scheiterte weiterhin bei `DESKTOP_CAPTURE_START`
mit `UnknownVizError`; allein das Einblenden behob die Aufnahme nicht.

Lokale Nachprüfung am 2026-11-08: `npm run verify` bestand alle sechs Tests,
`npm run smoke` alle sechs Größen-/Designkombinationen und eine nicht leere
Bildaufnahme unter Windows. Chromium meldete GPU-Cache-Warnungen; Laufzeitprüfungen
und Aufnahme waren erfolgreich. Der erste Versuch mit `npm run make` scheiterte
mit `ENOSPC`, weil das temporäre Systemlaufwerk C: voll war. Dies ist ein
Umgebungsfehler, getrennt vom Ubuntu-Renderingproblem. Die Wiederholung mit
prozesslokalen TEMP/TMP im ignorierten Ordner `apps/desktop/out/build-temp` auf
E: gelang einschließlich nicht signiertem Windows-Installer. Die neu gepackte
EXE bestand auch `npm run smoke` mit `Z2MA_SMOKE_BINARY` auf ihrem Pfad.
Systemeinstellungen wurden nicht geändert.

Lokal ist keine Ubuntu-/WSL-Distribution vorhanden. Native
Wayland-/X11-Desktop-Abnahme und der zusätzliche Ubuntu-26.04-Lauf bleiben
ungeprüft. Sie sind vom abgeschlossenen D1-CI-Umfang getrennt; die Abnahme
installierter Apps gehört zu D7.

Primärverträge: [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security),
[contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge),
[eigenes Protokoll](https://www.electronjs.org/docs/latest/api/protocol),
[Sichtbarkeit für Seitenaufnahmen](https://www.electronjs.org/docs/latest/api/browser-window#wincapturepagerect-opts),
[Forge-Konfiguration](https://www.electronforge.io/config/configuration),
[Debian-Programmpfad](https://github.com/electron-userland/electron-installer-debian#optionsbin).

Erste lokale Ergebnisse: sechs Desktop-Vertragstests, echte und gepackte
Electron-Smoke-Tests, Windows-Setup-Erzeugung, Symcon-Offline-PHP-Integration mit
228 JavaScript-Tests, echte Offline-Browserlokalisierung, 22 eigene JSON-Stilprüfungen
und PHP-CS-Fixer-Prüfungen bestanden. Kein installiertes Modul, Broker oder echte
Automation wurde verändert.

<a id="ci-follow-up-2026-11-08"></a>

## CI-Nachprüfung: 2026-11-08

[Lauf 42470140921](https://github.com/Burki24/Z2M-Automations/actions/runs/42470140921)
scheiterte auf beiden Plattformen beim Electron-Download mit HTTP 504. Frühere
Ubuntu-Läufe scheiterten auch bei Paketdownloads und bei Bildschirmaufnahmen
(`UnknownVizError`), nachdem funktionale und Größenprüfungen bestanden hatten.

Setup wiederholt jetzt ausschließlich vorübergehend fehlgeschlagene Downloads,
höchstens dreimal. Setup und Forge teilen Cache und die festgelegten
Electron-Prüfsummen; CI speichert die Downloads zwischen. Linux-CI-Smoke wählt
vor dem Start Software-Rendering. Normale Starts behalten ihre Einstellungen,
die Sandbox bleibt aktiv und die Aufnahme verpflichtend.

Lokale Windows-Prüfung bestanden: Setup, 13 Tests, Typen, Quell-/Paketprüfungen,
Erzeugung des nicht signierten Installers, Renderer-Aufnahme und Smoke-Test der
gepackten App. Der erste lokale Smoke-Test erreichte bei der Aufnahme seine
Frist; die Wiederholung mit prozesslokalen TEMP/TMP auf E: bestand. Auch der
Paketbau zeigte HTTP 504 vor dem Ergänzen der festen Prüfsummen und bestand
anschließend mit der vorhandenen geprüften ZIP. Globale Einstellungen blieben
unverändert. Der folgende erfolgreiche Lauf prüft diese Korrekturen in der
CI-Umgebung. Kein echtes System wurde verändert.

<a id="d1-completion-evidence-2026-11-08"></a>

## D1-Abschlussnachweis: 2026-11-08

[Lauf 42472007945](https://github.com/Burki24/Z2M-Automations/actions/runs/42472007945)
bestand für Quellcommit `f878516f2c677d5f45780523313bc599068ab82f` auf
`windows-2025` und `ubuntu-24.04`. Beide Jobs bestanden gemeinsame Quellprüfungen,
strikte Typen, alle 13 Tests, native Paketerzeugung, funktionalen Electron-Smoke,
360/1920/3840-Layouts in hell/dunkel, nicht leere Bildschirmaufnahme und den Bau
des versionierten Designer-Archivs. Beide Protokolle enthalten
`DESKTOP_CAPTURE_OK` und `DESKTOP_LAYOUT_OK`; Linux außerdem
`DESKTOP_CI_SOFTWARE_RENDERING`.

Beide Artefaktuploads gelangen: `desktop-Windows` mit ID `13613014349` und
`desktop-Linux` mit ID `13614220563`. Dies sind vorübergehende, nicht signierte
Entwicklungsartefakte, keine veröffentlichten Versionen. Die geprüfte Quelle
verwendete Anwendungsmetadaten 0.7.0; der folgende reine Metadatencommit setzt
die lokale Version auf 0.8.0.

| D1-Kriterium | Nachweis | Ergebnis |
| --- | --- | --- |
| Dieselbe gemeinsame Quelle startet auf beiden Plattformen | Beide Jobs verwenden den echten Electron-Renderer und begrenztes Preload | Bestanden |
| Synthetische Offline-Systeme und erhaltene Eingaben | Funktionaler Smoke prüft System-/Sprachwechsel und unveränderte Konfiguration | Bestanden |
| Begrenzte Desktop-Schnittstelle und Diagnose | Vertragstests und Prüfungen im echten Renderer | Bestanden |
| Native Build-Ziele und gemeinsame Designer-Übergabe | Windows-Setup, Ubuntu-`.deb`, Designer-Archiv und Artefaktuploads | Bestanden |
| Renderer-Layout und Aufnahme | Sechs Größen-/Designkombinationen und nicht leere Aufnahme auf beiden Plattformen | Bestanden |

Der maßgebliche Designer-/Paketvertrag und zuvor dokumentierte
Symcon-Importnachweise bleiben unverändert. Als Nächstes folgt D2 mit lokalen
Projekten, Entwürfen und geschützten Zugangsdaten. Native Tests installierter
Ubuntu-24.04-/26.04-Apps, Wayland/X11, Desktop-Integration, Signierung, Updates
und Deinstallationsabnahme benötigen weiterhin künftige Nachweise.
